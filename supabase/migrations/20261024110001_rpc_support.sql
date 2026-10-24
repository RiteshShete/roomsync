-- Shared plumbing for the RPCs (schema `private`, never exposed to the API).
-- Error convention: vocabulary errors (permission_denied, not_found, conflict, ...) are plain
-- `raise exception '<code>'` (P0001); input validation raises 23514 with 'validation:<field>:<code>'.

create function private.require_uid()
returns uuid language plpgsql stable set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'permission_denied'; end if;
  return u;
end;
$$;

create function private.clean_text(p_val text, p_field text, p_min int, p_max int)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := btrim(coalesce(p_val, ''));
begin
  if char_length(v) < p_min then
    raise exception 'validation:%:required', p_field using errcode = '23514';
  end if;
  if char_length(v) > p_max then
    raise exception 'validation:%:too_long', p_field using errcode = '23514';
  end if;
  return v;
end;
$$;

-- Ids of non-left members, optionally excluding one and/or filtering by role.
create function private.member_ids(p_hid uuid, p_exclude uuid default null, p_roles text[] default null)
returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(m.id order by m.joined_at, m.id), '{}')
  from public.household_members m
  where m.household_id = p_hid and m.status <> 'left'
    and m.id is distinct from p_exclude
    and (p_roles is null or m.role = any (p_roles));
$$;

create function private.emit_activity(
  p_hid uuid, p_actor uuid, p_type text, p_entity_type text, p_entity_id uuid,
  p_meta jsonb, p_recipients uuid[]
) returns void language sql set search_path = '' as $$
  insert into public.activity_events
    (household_id, actor_member_id, event_type, entity_type, entity_id, metadata, recipient_member_ids)
  values (p_hid, p_actor, p_type, p_entity_type, p_entity_id, coalesce(p_meta, '{}'::jsonb),
          coalesce(array(select r from unnest(p_recipients) r where r is distinct from p_actor), '{}'));
$$;

create function private.emit_audit(
  p_hid uuid, p_actor uuid, p_entity_type text, p_entity_id uuid, p_action text,
  p_before jsonb, p_after jsonb
) returns void language sql set search_path = '' as $$
  insert into public.audit_events (household_id, actor_member_id, entity_type, entity_id, action, before, after)
  values (p_hid, p_actor, p_entity_type, p_entity_id, p_action, p_before, p_after);
$$;

-- Deterministic SQL mirror of src/domain/rotation.ts#nextOccurrence. Shared vectors live in
-- supabase/tests/rotation.test.sql and src/domain/domain.test.ts.
create function private.next_occurrence(p_due date, p_freq text, p_today date)
returns date language plpgsql immutable set search_path = '' as $$
declare step int; n int; nxt date;
begin
  if p_freq in ('daily', 'weekly', 'biweekly') then
    step := case p_freq when 'daily' then 1 when 'weekly' then 7 else 14 end;
    n := greatest(1, ceil((p_today - p_due)::numeric / step)::int);
    return p_due + n * step;
  elsif p_freq = 'monthly' then
    n := 1;
    loop
      nxt := (p_due + make_interval(months => n))::date;  -- clamps to month end, anchored on p_due
      exit when nxt >= p_today;
      n := n + 1;
    end loop;
    return nxt;
  end if;
  raise exception 'validation:recurrence_frequency:invalid' using errcode = '23514';
end;
$$;

-- SQL mirror of src/domain/rotation.ts#nextAssignee. `skipped` lists members passed over.
create function private.next_assignee(p_rotation uuid[], p_current uuid, p_active uuid[])
returns table (assignee uuid, skipped uuid[])
language plpgsql immutable set search_path = '' as $$
declare
  n int := coalesce(cardinality(p_rotation), 0);
  start0 int; k int; cand uuid; skp uuid[] := '{}';
begin
  if n = 0 then
    return query select null::uuid, '{}'::uuid[];
    return;
  end if;
  start0 := coalesce(array_position(p_rotation, p_current), 0) - 1;
  for k in 1..n loop
    cand := p_rotation[((start0 + k) % n) + 1];
    if cand = any (p_active) then
      return query select cand, skp;
      return;
    end if;
    skp := skp || cand;
  end loop;
  return query select null::uuid, skp;
end;
$$;

-- Net balance per member (PLAN D3, D8). Positive = is owed. Same rules as src/domain/balances.ts:
-- deleted expenses excluded; only `recorded` settlements count (disputed/reversed excluded).
create function private.compute_balances(p_hid uuid)
returns table (member_id uuid, net_minor bigint)
language sql stable set search_path = '' as $$
  select m.id,
    (coalesce((select sum(x.amount_minor) from public.expenses x
                where x.household_id = p_hid and x.deleted_at is null and x.paid_by_member_id = m.id), 0)
   - coalesce((select sum(s.share_amount_minor) from public.expense_shares s
                join public.expenses x on x.id = s.expense_id
                where s.household_id = p_hid and x.deleted_at is null and s.member_id = m.id), 0)
   + coalesce((select sum(t.amount_minor) from public.settlements t
                where t.household_id = p_hid and t.status = 'recorded' and t.from_member_id = m.id), 0)
   - coalesce((select sum(t.amount_minor) from public.settlements t
                where t.household_id = p_hid and t.status = 'recorded' and t.to_member_id = m.id), 0)
    )::bigint
  from public.household_members m
  where m.household_id = p_hid;
$$;

-- Lazy move-out reconciliation (PLAN D10). Members whose effective date has passed become `left`,
-- their open chores are reassigned by rotation (or unassigned), and they leave every rotation.
create function private.reconcile(p_hid uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  flipped uuid[]; fid uuid; active_ids uuid[]; admin_ids uuid[]; nonleft_ids uuid[];
  rec record; pick uuid; skp uuid[]; new_rot uuid[];
begin
  with u as (
    update public.household_members set status = 'left', left_at = now()
     where household_id = p_hid and status = 'leaving' and move_out_effective_date <= current_date
     returning id)
  select coalesce(array_agg(id), '{}') into flipped from u;
  if cardinality(flipped) = 0 then return 0; end if;

  active_ids := array(select id from public.household_members where household_id = p_hid and status = 'active');
  nonleft_ids := private.member_ids(p_hid);
  admin_ids := private.member_ids(p_hid, null, array['owner', 'admin']);

  foreach fid in array flipped loop
    perform private.emit_activity(p_hid, fid, 'member.left', 'member', fid, '{}'::jsonb, nonleft_ids);
  end loop;

  for rec in
    select * from public.chores
     where household_id = p_hid and status = 'open'
       and (assignee_member_id = any (flipped) or rotation_member_ids && flipped)
     for update
  loop
    new_rot := null;
    pick := rec.assignee_member_id;
    skp := '{}';
    if rec.rotation_member_ids is not null then
      new_rot := array(select x from unnest(rec.rotation_member_ids) with ordinality t (x, ord)
                        where x = any (nonleft_ids) order by ord);
      if cardinality(new_rot) < 2 then new_rot := null; end if;
    end if;
    if rec.assignee_member_id = any (flipped) then
      pick := null;
      if rec.rotation_member_ids is not null then
        select a.assignee, a.skipped into pick, skp
          from private.next_assignee(rec.rotation_member_ids, rec.assignee_member_id, active_ids) a;
      end if;
    end if;
    update public.chores set assignee_member_id = pick, rotation_member_ids = new_rot where id = rec.id;
    if rec.assignee_member_id = any (flipped) then
      if pick is null then
        perform private.emit_activity(p_hid, null, 'chore.needs_assignee', 'chore', rec.id,
          jsonb_build_object('title', rec.title), admin_ids);
      else
        perform private.emit_activity(p_hid, null, 'chore.reassigned', 'chore', rec.id,
          jsonb_build_object('title', rec.title, 'skipped_member_ids', to_jsonb(skp)), array[pick]);
      end if;
    end if;
  end loop;

  return cardinality(flipped);
end;
$$;

-- Caller context for every RPC: authenticates, reconciles the household, returns the caller's
-- (non-left) member row, and rejects writes to an archived household. A non-member sees
-- `not_found`, so ids from other households are indistinguishable from missing ones.
create function private.ctx(p_hid uuid, p_write boolean default true)
returns public.household_members language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid(); m public.household_members;
begin
  perform private.reconcile(p_hid);
  select * into m from public.household_members
   where household_id = p_hid and user_id = u and status <> 'left';
  if not found then raise exception 'not_found'; end if;
  if p_write and exists (select 1 from public.households h where h.id = p_hid and h.status = 'archived') then
    raise exception 'household_archived';
  end if;
  return m;
end;
$$;

create function private.is_admin_role(p_role text)
returns boolean language sql immutable set search_path = '' as $$
  select p_role in ('owner', 'admin');
$$;

create function private.expense_snapshot(p_eid uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'title', e.title, 'amount_minor', e.amount_minor, 'currency_code', e.currency_code,
    'category', e.category, 'paid_by_member_id', e.paid_by_member_id,
    'expense_date', e.expense_date, 'split_method', e.split_method, 'deleted_at', e.deleted_at,
    'shares', (select coalesce(jsonb_agg(jsonb_build_object(
                 'member_id', s.member_id, 'share_amount_minor', s.share_amount_minor,
                 'percent_bp', s.percent_bp) order by s.member_id), '[]'::jsonb)
               from public.expense_shares s where s.expense_id = e.id))
  from public.expenses e where e.id = p_eid;
$$;
