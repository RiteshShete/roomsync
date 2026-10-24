-- Household lifecycle and membership RPCs.

create function public.create_household(
  p_name text,
  p_currency_code text default 'INR',
  p_default_split text default 'equal',
  p_chore_reminders boolean default true
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_uid();
  nm text := private.clean_text(p_name, 'name', 1, 80);
  hid uuid; mid uuid;
begin
  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'validation:currency_code:invalid' using errcode = '23514';
  end if;
  if p_default_split is null or p_default_split not in ('equal', 'custom', 'percentage') then
    raise exception 'validation:default_split:invalid' using errcode = '23514';
  end if;
  if exists (select 1 from public.household_members where user_id = u and status <> 'left') then
    raise exception 'already_member';
  end if;

  insert into public.households (name, currency_code, default_split, chore_reminders_enabled, created_by)
  values (nm, p_currency_code, p_default_split, coalesce(p_chore_reminders, true), u)
  returning id into hid;
  insert into public.household_members (household_id, user_id, role)
  values (hid, u, 'owner') returning id into mid;

  perform private.emit_audit(hid, mid, 'household', hid, 'created', null,
    jsonb_build_object('name', nm, 'currency_code', p_currency_code));
  return hid;
end;
$$;

create function public.update_household(
  p_household_id uuid,
  p_expected_version int,
  p_name text default null,
  p_currency_code text default null,
  p_default_split text default null,
  p_chore_reminders boolean default null
) returns int language plpgsql security definer set search_path = '' as $$
declare m public.household_members := private.ctx(p_household_id); h public.households; nh public.households;
begin
  if not private.is_admin_role(m.role) then raise exception 'permission_denied'; end if;
  select * into h from public.households where id = p_household_id for update;
  if h.version <> p_expected_version then raise exception 'conflict'; end if;
  if p_name is not null then perform private.clean_text(p_name, 'name', 1, 80); end if;
  if p_currency_code is not null and p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'validation:currency_code:invalid' using errcode = '23514';
  end if;
  if p_default_split is not null and p_default_split not in ('equal', 'custom', 'percentage') then
    raise exception 'validation:default_split:invalid' using errcode = '23514';
  end if;

  update public.households set
    name = coalesce(btrim(p_name), name),
    currency_code = coalesce(p_currency_code, currency_code),  -- trigger raises currency_locked
    default_split = coalesce(p_default_split, default_split),
    chore_reminders_enabled = coalesce(p_chore_reminders, chore_reminders_enabled)
  where id = p_household_id returning * into nh;

  perform private.emit_audit(p_household_id, m.id, 'household', p_household_id, 'updated',
    jsonb_build_object('name', h.name, 'currency_code', h.currency_code, 'default_split', h.default_split,
                       'chore_reminders_enabled', h.chore_reminders_enabled),
    jsonb_build_object('name', nh.name, 'currency_code', nh.currency_code, 'default_split', nh.default_split,
                       'chore_reminders_enabled', nh.chore_reminders_enabled));
  return nh.version;
end;
$$;

-- Owner only. Restoring is allowed while archived; everything else is blocked by ctx().
create function public.set_household_archived(
  p_household_id uuid,
  p_archived boolean,
  p_expected_version int default null
) returns int language plpgsql security definer set search_path = '' as $$
declare m public.household_members := private.ctx(p_household_id, false); h public.households; nh public.households;
begin
  if m.role <> 'owner' then raise exception 'permission_denied'; end if;
  select * into h from public.households where id = p_household_id for update;
  if p_expected_version is not null and h.version <> p_expected_version then raise exception 'conflict'; end if;
  if p_archived is null then raise exception 'validation:archived:required' using errcode = '23514'; end if;
  if (h.status = 'archived') = p_archived then return h.version; end if;

  update public.households set status = case when p_archived then 'archived' else 'active' end
   where id = p_household_id returning * into nh;
  perform private.emit_audit(p_household_id, m.id, 'household', p_household_id,
    case when p_archived then 'archived' else 'restored' end,
    jsonb_build_object('status', h.status), jsonb_build_object('status', nh.status));
  perform private.emit_activity(p_household_id, m.id,
    case when p_archived then 'household.archived' else 'household.restored' end,
    'household', p_household_id, '{}'::jsonb, private.member_ids(p_household_id, m.id));
  return nh.version;
end;
$$;

-- Owner only. Owners are changed with transfer_ownership, never here.
create function public.set_member_role(p_member_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.household_members; m public.household_members;
begin
  select * into t from public.household_members where id = p_member_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(t.household_id);
  if m.role <> 'owner' then raise exception 'permission_denied'; end if;
  if p_role is null or p_role not in ('admin', 'member') then
    raise exception 'validation:role:invalid' using errcode = '23514';
  end if;
  select * into t from public.household_members where id = p_member_id for update;
  if t.status = 'left' then raise exception 'not_found'; end if;
  if t.role = 'owner' then raise exception 'validation:role:use_transfer' using errcode = '23514'; end if;
  if t.role = p_role then return; end if;

  update public.household_members set role = p_role where id = p_member_id;
  perform private.emit_audit(t.household_id, m.id, 'member', t.id, 'role_changed',
    jsonb_build_object('role', t.role), jsonb_build_object('role', p_role));
  perform private.emit_activity(t.household_id, m.id, 'member.role_changed', 'member', t.id,
    jsonb_build_object('role', p_role), array[t.id]);
end;
$$;

-- Owner only. Demotes the current owner first so the one-owner index is never violated.
create function public.transfer_ownership(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.household_members; m public.household_members;
begin
  select * into t from public.household_members where id = p_member_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(t.household_id);
  if m.role <> 'owner' then raise exception 'permission_denied'; end if;
  if t.id = m.id then raise exception 'validation:member:self' using errcode = '23514'; end if;
  if t.status <> 'active' then raise exception 'validation:member:not_active' using errcode = '23514'; end if;

  set constraints all deferred;  -- the household briefly has no owner between the two updates
  update public.household_members set role = 'admin' where id = m.id;
  update public.household_members set role = 'owner' where id = t.id;
  set constraints all immediate;
  perform private.emit_audit(t.household_id, m.id, 'member', t.id, 'ownership_transferred',
    jsonb_build_object('owner_member_id', m.id), jsonb_build_object('owner_member_id', t.id));
  perform private.emit_activity(t.household_id, m.id, 'member.ownership_transferred', 'member', t.id,
    '{}'::jsonb, private.member_ids(t.household_id, m.id));
end;
$$;

-- Self, or an owner for anyone, or an admin for anyone except the owner.
create function public.start_move_out(
  p_member_id uuid,
  p_effective_date date,
  p_note text default null,
  p_acknowledged_balance_minor bigint default null
) returns void language plpgsql security definer set search_path = '' as $$
declare t public.household_members; m public.household_members; note text;
begin
  select * into t from public.household_members where id = p_member_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(t.household_id);
  if not (t.id = m.id or m.role = 'owner' or (m.role = 'admin' and t.role <> 'owner')) then
    raise exception 'permission_denied';
  end if;
  select * into t from public.household_members where id = p_member_id for update;
  if t.status = 'left' then raise exception 'not_found'; end if;

  if t.role = 'owner' then
    if exists (select 1 from public.household_members
                where household_id = t.household_id and status <> 'left' and id <> t.id) then
      raise exception 'owner_must_transfer';
    end if;
    raise exception 'sole_member';
  end if;
  if t.status <> 'active' then
    raise exception 'validation:status:not_active' using errcode = '23514';
  end if;
  if p_effective_date is null or p_effective_date < current_date or p_effective_date > current_date + 90 then
    raise exception 'validation:effective_date:out_of_range' using errcode = '23514';
  end if;
  note := nullif(btrim(coalesce(p_note, '')), '');
  if note is not null then perform private.clean_text(note, 'note', 1, 1000); end if;

  update public.household_members set
    status = 'leaving', move_out_requested_at = now(), move_out_requested_by = m.id,
    move_out_effective_date = p_effective_date, move_out_note = note,
    move_out_acknowledged_balance_minor = p_acknowledged_balance_minor
  where id = t.id;

  perform private.emit_audit(t.household_id, m.id, 'member', t.id, 'move_out_started', null,
    jsonb_build_object('effective_date', p_effective_date));
  perform private.emit_activity(t.household_id, m.id, 'member.move_out_started', 'member', t.id,
    jsonb_build_object('effective_date', p_effective_date), private.member_ids(t.household_id, m.id));
  perform private.reconcile(t.household_id);  -- effective today flips immediately
end;
$$;

create function public.cancel_move_out(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.household_members; m public.household_members;
begin
  select * into t from public.household_members where id = p_member_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(t.household_id);
  if not (t.id = m.id or m.role = 'owner' or (m.role = 'admin' and t.role <> 'owner')) then
    raise exception 'permission_denied';
  end if;
  select * into t from public.household_members where id = p_member_id for update;
  if t.status <> 'leaving' then raise exception 'conflict'; end if;

  update public.household_members set
    status = 'active', move_out_requested_at = null, move_out_requested_by = null,
    move_out_effective_date = null, move_out_note = null, move_out_acknowledged_balance_minor = null
  where id = t.id;
  perform private.emit_audit(t.household_id, m.id, 'member', t.id, 'move_out_cancelled', null, null);
  perform private.emit_activity(t.household_id, m.id, 'member.move_out_cancelled', 'member', t.id,
    '{}'::jsonb, private.member_ids(t.household_id, m.id));
end;
$$;

-- Only the leaving member can attach a note/dispute; it is never auto-resolved.
create function public.add_move_out_dispute(p_member_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t public.household_members; m public.household_members; did uuid; nt text;
begin
  select * into t from public.household_members where id = p_member_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(t.household_id);
  if t.id <> m.id then raise exception 'permission_denied'; end if;
  if m.status <> 'leaving' then raise exception 'conflict'; end if;
  nt := private.clean_text(p_note, 'note', 1, 1000);

  insert into public.member_move_out_disputes (member_id, note) values (m.id, nt) returning id into did;
  perform private.emit_activity(m.household_id, m.id, 'member.move_out_disputed', 'member', m.id,
    '{}'::jsonb, private.member_ids(m.household_id, m.id, array['owner', 'admin']));
  return did;
end;
$$;

-- Any person who has ever belonged to the household may trigger reconciliation (the leaving member
-- needs this to learn they have left). Returns how many members flipped to `left`.
create function public.reconcile_household(p_household_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid();
begin
  if not exists (select 1 from public.household_members where household_id = p_household_id and user_id = u) then
    raise exception 'not_found';
  end if;
  return private.reconcile(p_household_id);
end;
$$;

-- Net balance per member of a household the caller belongs to.
create function public.household_balances(p_household_id uuid)
returns table (member_id uuid, net_minor bigint)
language plpgsql security definer set search_path = '' as $$
declare m public.household_members := private.ctx(p_household_id, false);
begin
  return query select b.member_id, b.net_minor from private.compute_balances(p_household_id) b;
end;
$$;
