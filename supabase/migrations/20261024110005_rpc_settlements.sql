-- Settlements are RECORDED, never sent: RoomSync does not move money.

create function public.record_settlement(
  p_household_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount_minor bigint,
  p_settlement_date date,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  m public.household_members := private.ctx(p_household_id);
  h public.households; sid uuid;
begin
  -- admins/owner may record any pair; a member only when they are the payer or the recipient
  if not (private.is_admin_role(m.role) or m.id in (p_from_member_id, p_to_member_id)) then
    raise exception 'permission_denied';
  end if;
  if p_from_member_id is null or p_to_member_id is null or p_from_member_id = p_to_member_id then
    raise exception 'validation:settlement:same_member' using errcode = '23514';
  end if;
  if p_amount_minor is null or p_amount_minor < 1 or p_amount_minor > 10000000000 then
    raise exception 'validation:amount:out_of_range' using errcode = '23514';
  end if;
  if p_settlement_date is null then raise exception 'validation:settlement_date:required' using errcode = '23514'; end if;
  if p_settlement_date > current_date then raise exception 'validation:settlement_date:future' using errcode = '23514'; end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'validation:note:too_long' using errcode = '23514';
  end if;
  -- parties may have left (their unresolved balance can still be settled), but must belong here
  if (select count(*) from public.household_members
       where household_id = p_household_id and id in (p_from_member_id, p_to_member_id)) <> 2 then
    raise exception 'not_found';
  end if;

  select * into h from public.households where id = p_household_id;
  insert into public.settlements (household_id, from_member_id, to_member_id, amount_minor, currency_code,
                                  settlement_date, note, recorded_by)
  values (p_household_id, p_from_member_id, p_to_member_id, p_amount_minor, h.currency_code,
          p_settlement_date, nullif(btrim(coalesce(p_note, '')), ''), m.user_id)
  returning id into sid;

  perform private.emit_audit(p_household_id, m.id, 'settlement', sid, 'recorded', null,
    jsonb_build_object('from_member_id', p_from_member_id, 'to_member_id', p_to_member_id,
                       'amount_minor', p_amount_minor, 'currency_code', h.currency_code));
  perform private.emit_activity(p_household_id, m.id, 'settlement.recorded', 'settlement', sid,
    jsonb_build_object('amount_minor', p_amount_minor, 'currency_code', h.currency_code,
                       'from_member_id', p_from_member_id, 'to_member_id', p_to_member_id),
    array[p_from_member_id, p_to_member_id]);
  return sid;
end;
$$;

-- recorded -> reversed (admin, or the member who recorded it)
-- recorded -> disputed (admin, or the OTHER party who did not record it; reason required)
-- disputed -> reversed (admin, or the recorder)
-- disputed -> recorded (admin, or whoever raised the dispute, i.e. withdrawing it)
-- reversed is final. Disputed settlements do not count toward balances (PLAN D8).
create function public.set_settlement_status(
  p_settlement_id uuid,
  p_status text,
  p_reason text default null,
  p_expected_version int default null
) returns int language plpgsql security definer set search_path = '' as $$
declare
  s public.settlements; m public.household_members; ns public.settlements;
  admin boolean; is_party boolean; is_recorder boolean; ok boolean := false; reason text;
begin
  select * into s from public.settlements where id = p_settlement_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(s.household_id);
  select * into s from public.settlements where id = p_settlement_id for update;
  if p_expected_version is not null and s.version <> p_expected_version then raise exception 'conflict'; end if;
  if p_status is null or p_status not in ('recorded', 'reversed', 'disputed') then
    raise exception 'validation:status:invalid' using errcode = '23514';
  end if;
  if s.status = p_status or s.status = 'reversed' then raise exception 'conflict'; end if;

  admin := private.is_admin_role(m.role);
  is_party := m.id in (s.from_member_id, s.to_member_id);
  is_recorder := s.recorded_by = m.user_id;
  reason := nullif(btrim(coalesce(p_reason, '')), '');
  if reason is not null and char_length(reason) > 1000 then
    raise exception 'validation:reason:too_long' using errcode = '23514';
  end if;

  if s.status = 'recorded' and p_status = 'reversed' then ok := admin or is_recorder;
  elsif s.status = 'recorded' and p_status = 'disputed' then ok := admin or (is_party and not is_recorder);
  elsif s.status = 'disputed' and p_status = 'reversed' then ok := admin or is_recorder;
  elsif s.status = 'disputed' and p_status = 'recorded' then ok := admin or s.status_changed_by = m.user_id;
  end if;
  if not ok then raise exception 'permission_denied'; end if;
  if p_status = 'disputed' and reason is null then
    raise exception 'validation:reason:required' using errcode = '23514';
  end if;

  update public.settlements set status = p_status, status_changed_by = m.user_id,
         status_changed_at = now(), status_reason = reason
   where id = s.id returning * into ns;

  perform private.emit_audit(s.household_id, m.id, 'settlement', s.id, 'status_' || p_status,
    jsonb_build_object('status', s.status), jsonb_build_object('status', p_status));
  perform private.emit_activity(s.household_id, m.id, 'settlement.' || p_status, 'settlement', s.id,
    jsonb_build_object('amount_minor', s.amount_minor, 'currency_code', s.currency_code),
    array[s.from_member_id, s.to_member_id]);
  return ns.version;
end;
$$;
