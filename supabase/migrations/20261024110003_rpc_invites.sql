-- Invitations (PLAN D7). Codes are 8 chars from an unambiguous alphabet, stored only as a SHA-256
-- hash, and shown once. preview/join RETURN {ok:false, error:'invalid_invite:<reason>'} instead of
-- raising: a raised error would roll back the failed-attempt row and defeat the throttle.

create function private.generate_invite_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 chars
  code text := ''; b int;
begin
  while char_length(code) < 8 loop
    b := get_byte(extensions.gen_random_bytes(1), 0);
    if b < 248 then  -- 248 = 31 * 8: reject the tail so every char is equally likely
      code := code || substr(alphabet, (b % 31) + 1, 1);
    end if;
  end loop;
  return code;
end;
$$;

create function private.hash_invite_code(p_code text)
returns text language sql immutable security definer set search_path = '' as $$
  select encode(extensions.digest(p_code, 'sha256'), 'hex');
$$;

create function private.invite_throttled(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.invite_attempts
           where user_id = p_uid and not succeeded and attempted_at > now() - interval '1 hour') >= 10;
$$;

-- Returns the invitation (locked when asked) or an error code; never raises for bad codes.
create function private.resolve_invite(p_code text, p_lock boolean, out inv public.invitations, out err text)
language plpgsql security definer set search_path = '' as $$
declare code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
begin
  if code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' then
    err := 'invalid_invite:not_found'; return;
  end if;
  if p_lock then
    select * into inv from public.invitations where code_hash = private.hash_invite_code(code) for update;
  else
    select * into inv from public.invitations where code_hash = private.hash_invite_code(code);
  end if;
  if not found then err := 'invalid_invite:not_found'; return; end if;
  if inv.status = 'revoked' then err := 'invalid_invite:revoked';
  elsif inv.status = 'expired' or inv.expires_at <= now() then err := 'invalid_invite:expired';
  elsif inv.max_uses is not null and inv.use_count >= inv.max_uses then err := 'invalid_invite:used_up';
  elsif exists (select 1 from public.households h where h.id = inv.household_id and h.status = 'archived') then
    err := 'invalid_invite:household_archived';
  elsif (select count(*) from public.household_members m
          where m.household_id = inv.household_id and m.status <> 'left') >= 12 then
    err := 'invalid_invite:household_full';
  end if;
end;
$$;

create function public.create_invite(
  p_household_id uuid,
  p_expires_in_hours int default 168,
  p_max_uses int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m public.household_members := private.ctx(p_household_id);
  code text; iid uuid; exp timestamptz; tries int := 0;
begin
  if not private.is_admin_role(m.role) then raise exception 'permission_denied'; end if;
  if p_expires_in_hours is null or p_expires_in_hours < 1 or p_expires_in_hours > 720 then
    raise exception 'validation:expires_in_hours:out_of_range' using errcode = '23514';
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 100) then
    raise exception 'validation:max_uses:out_of_range' using errcode = '23514';
  end if;
  if (select count(*) from public.invitations
       where household_id = p_household_id and status = 'active' and expires_at > now()) >= 20 then
    raise exception 'validation:invites:too_many' using errcode = '23514';
  end if;

  exp := now() + make_interval(hours => p_expires_in_hours);
  loop
    code := private.generate_invite_code();
    begin
      insert into public.invitations (household_id, created_by, code_hash, code_hint, expires_at, max_uses)
      values (p_household_id, m.user_id, private.hash_invite_code(code), right(code, 2), exp, p_max_uses)
      returning id into iid;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;

  perform private.emit_audit(p_household_id, m.id, 'invitation', iid, 'created', null,
    jsonb_build_object('expires_at', exp, 'max_uses', p_max_uses));
  return jsonb_build_object('invite_id', iid, 'code', code, 'expires_at', exp);
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.invitations; m public.household_members;
begin
  select * into i from public.invitations where id = p_invite_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(i.household_id);
  if not private.is_admin_role(m.role) then raise exception 'permission_denied'; end if;
  if i.status <> 'active' then return; end if;
  update public.invitations set status = 'revoked' where id = i.id;
  perform private.emit_audit(i.household_id, m.id, 'invitation', i.id, 'revoked', null, null);
end;
$$;

-- Household name, member count and expiry only: no member identities.
create function public.preview_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid(); r record; hname text; cnt int;
begin
  if exists (select 1 from public.household_members where user_id = u and status <> 'left') then
    raise exception 'already_member';
  end if;
  if private.invite_throttled(u) then
    return jsonb_build_object('ok', false, 'error', 'invalid_invite:throttled');
  end if;
  select * into r from private.resolve_invite(p_code, false);
  insert into public.invite_attempts (user_id, succeeded) values (u, r.err is null);
  if r.err is not null then
    return jsonb_build_object('ok', false, 'error', r.err);
  end if;
  select h.name into hname from public.households h where h.id = (r.inv).household_id;
  select count(*) into cnt from public.household_members m
   where m.household_id = (r.inv).household_id and m.status <> 'left';
  return jsonb_build_object('ok', true, 'household_name', hname, 'member_count', cnt,
                            'expires_at', (r.inv).expires_at);
end;
$$;

create function public.join_household(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid(); r record; mid uuid; hid uuid;
begin
  if exists (select 1 from public.household_members where user_id = u and status <> 'left') then
    raise exception 'already_member';
  end if;
  if private.invite_throttled(u) then
    return jsonb_build_object('ok', false, 'error', 'invalid_invite:throttled');
  end if;
  select * into r from private.resolve_invite(p_code, true);
  if r.err is not null then
    insert into public.invite_attempts (user_id, succeeded) values (u, false);
    return jsonb_build_object('ok', false, 'error', r.err);
  end if;
  hid := (r.inv).household_id;

  insert into public.household_members (household_id, user_id, role) values (hid, u, 'member')
  returning id into mid;
  update public.invitations set use_count = use_count + 1 where id = (r.inv).id;
  insert into public.invite_attempts (user_id, succeeded) values (u, true);

  perform private.emit_audit(hid, mid, 'member', mid, 'joined', null, jsonb_build_object('invitation_id', (r.inv).id));
  perform private.emit_activity(hid, mid, 'member.joined', 'member', mid, '{}'::jsonb, private.member_ids(hid, mid));
  return jsonb_build_object('ok', true, 'household_id', hid);
end;
$$;
