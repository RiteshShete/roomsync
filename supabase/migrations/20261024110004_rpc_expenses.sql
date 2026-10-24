-- Expenses. The client computes shares (PLAN D4); these RPCs validate and persist expense + shares
-- atomically. p_shares is a JSON array of {member_id, share_amount_minor, percent_bp?}.
-- Edits and deletes write audit rows; deletes are soft.

-- Validates and normalises the shared input of add/edit. Raises validation errors.
create function private.validate_expense_input(
  p_hid uuid, p_title text, p_amount_minor bigint, p_category text, p_paid_by uuid,
  p_date date, p_method text, p_shares jsonb
) returns void language plpgsql stable security definer set search_path = '' as $$
declare cnt int; dist int;
begin
  perform private.clean_text(p_title, 'title', 1, 120);
  if p_category is not null then perform private.clean_text(p_category, 'category', 1, 50); end if;
  if p_amount_minor is null or p_amount_minor < 1 or p_amount_minor > 10000000000 then
    raise exception 'validation:amount:out_of_range' using errcode = '23514';
  end if;
  if p_date is null then raise exception 'validation:expense_date:required' using errcode = '23514'; end if;
  if p_method is null or p_method not in ('equal', 'custom', 'percentage') then
    raise exception 'validation:split_method:invalid' using errcode = '23514';
  end if;
  if p_paid_by is null then raise exception 'validation:paid_by:required' using errcode = '23514'; end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'validation:shares:required' using errcode = '23514';
  end if;
  select count(*), count(distinct x.member_id) into cnt, dist
    from jsonb_to_recordset(p_shares) as x (member_id uuid, share_amount_minor bigint, percent_bp int);
  if cnt <> dist then raise exception 'validation:shares:duplicate_member' using errcode = '23514'; end if;
  if exists (select 1 from jsonb_to_recordset(p_shares) as x (member_id uuid, share_amount_minor bigint, percent_bp int)
              where x.member_id is null or x.share_amount_minor is null) then
    raise exception 'validation:shares:incomplete' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_shares) as x (member_id uuid, share_amount_minor bigint, percent_bp int)
              where (p_method = 'percentage') <> (x.percent_bp is not null)) then
    raise exception 'validation:shares:percent_bp' using errcode = '23514';
  end if;
end;
$$;

create function public.add_expense(
  p_household_id uuid,
  p_title text,
  p_amount_minor bigint,
  p_category text,
  p_paid_by_member_id uuid,
  p_expense_date date,
  p_split_method text,
  p_shares jsonb,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  m public.household_members := private.ctx(p_household_id);
  h public.households;
  eid uuid; ids uuid[];
begin
  perform private.validate_expense_input(p_household_id, p_title, p_amount_minor, p_category,
    p_paid_by_member_id, p_expense_date, p_split_method, p_shares);
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'validation:notes:too_long' using errcode = '23514';
  end if;

  -- payer and participants of a NEW expense must be active or leaving members
  ids := array(select x.member_id from jsonb_to_recordset(p_shares) as x (member_id uuid, share_amount_minor bigint, percent_bp int))
         || p_paid_by_member_id;
  if exists (select 1 from unnest(ids) i where not private.is_assignable_member(i, p_household_id)) then
    raise exception 'validation:participants:not_assignable' using errcode = '23514';
  end if;

  select * into h from public.households where id = p_household_id;
  set constraints all deferred;  -- an earlier call in this transaction may have set them immediate
  insert into public.expenses (household_id, title, amount_minor, currency_code, category, paid_by_member_id,
                               expense_date, notes, split_method, created_by, updated_by)
  values (p_household_id, btrim(p_title), p_amount_minor, h.currency_code, coalesce(btrim(p_category), 'other'),
          p_paid_by_member_id, p_expense_date, nullif(btrim(coalesce(p_notes, '')), ''), p_split_method,
          m.user_id, m.user_id)
  returning id into eid;

  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method, percent_bp)
  select eid, p_household_id, x.member_id, x.share_amount_minor, p_split_method, x.percent_bp
    from jsonb_to_recordset(p_shares) as x (member_id uuid, share_amount_minor bigint, percent_bp int);
  set constraints all immediate;  -- surface share invariants now, with their own messages

  perform private.emit_audit(p_household_id, m.id, 'expense', eid, 'created', null, private.expense_snapshot(eid));
  perform private.emit_activity(p_household_id, m.id, 'expense.added', 'expense', eid,
    jsonb_build_object('title', btrim(p_title), 'amount_minor', p_amount_minor, 'currency_code', h.currency_code),
    ids);
  return eid;
end;
$$;

-- Returns {version, settlements_exist, impact:[{member_id, before_minor, after_minor}]} so the UI can
-- explain how the edit moved balances (spec §11.1).
create function public.edit_expense(
  p_expense_id uuid,
  p_expected_version int,
  p_title text,
  p_amount_minor bigint,
  p_category text,
  p_paid_by_member_id uuid,
  p_expense_date date,
  p_split_method text,
  p_shares jsonb,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses; m public.household_members; ne public.expenses;
  before_snap jsonb; old_ids uuid[]; new_ids uuid[]; before_bal jsonb; after_bal jsonb; impact jsonb;
begin
  select * into e from public.expenses where id = p_expense_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(e.household_id);
  if not (private.is_admin_role(m.role) or e.created_by = m.user_id) then raise exception 'permission_denied'; end if;

  select * into e from public.expenses where id = p_expense_id for update;
  if e.deleted_at is not null or e.version <> p_expected_version then raise exception 'conflict'; end if;
  perform private.validate_expense_input(e.household_id, p_title, p_amount_minor, p_category,
    p_paid_by_member_id, p_expense_date, p_split_method, p_shares);
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'validation:notes:too_long' using errcode = '23514';
  end if;

  -- only members that are new to this expense must be active/leaving; existing ones may have left
  old_ids := array(select member_id from public.expense_shares where expense_id = e.id) || e.paid_by_member_id;
  new_ids := array(select x.member_id from jsonb_to_recordset(p_shares) as x (member_id uuid, share_amount_minor bigint, percent_bp int))
             || p_paid_by_member_id;
  if exists (select 1 from unnest(new_ids) i
              where i <> all (old_ids) and not private.is_assignable_member(i, e.household_id)) then
    raise exception 'validation:participants:not_assignable' using errcode = '23514';
  end if;

  before_snap := private.expense_snapshot(e.id);
  before_bal := (select coalesce(jsonb_object_agg(b.member_id, b.net_minor), '{}') from private.compute_balances(e.household_id) b);

  set constraints all deferred;
  update public.expenses set
    title = btrim(p_title), amount_minor = p_amount_minor, category = coalesce(btrim(p_category), 'other'),
    paid_by_member_id = p_paid_by_member_id, expense_date = p_expense_date, split_method = p_split_method,
    notes = nullif(btrim(coalesce(p_notes, '')), ''), updated_by = m.user_id
  where id = e.id returning * into ne;
  delete from public.expense_shares where expense_id = e.id;
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method, percent_bp)
  select e.id, e.household_id, x.member_id, x.share_amount_minor, p_split_method, x.percent_bp
    from jsonb_to_recordset(p_shares) as x (member_id uuid, share_amount_minor bigint, percent_bp int);
  set constraints all immediate;

  after_bal := (select coalesce(jsonb_object_agg(b.member_id, b.net_minor), '{}') from private.compute_balances(e.household_id) b);
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', k.key, 'before_minor', (before_bal ->> k.key)::bigint, 'after_minor', (after_bal ->> k.key)::bigint)
           order by k.key), '[]'::jsonb)
    into impact
    from jsonb_object_keys(after_bal) as k (key)
   where (before_bal ->> k.key)::bigint is distinct from (after_bal ->> k.key)::bigint;

  perform private.emit_audit(e.household_id, m.id, 'expense', e.id, 'edited', before_snap, private.expense_snapshot(e.id));
  perform private.emit_activity(e.household_id, m.id, 'expense.edited', 'expense', e.id,
    jsonb_build_object('title', btrim(p_title), 'amount_minor', p_amount_minor, 'previous_amount_minor', e.amount_minor,
                       'currency_code', e.currency_code),
    old_ids || new_ids);
  return jsonb_build_object(
    'version', ne.version + 0,
    'settlements_exist', exists (select 1 from public.settlements s
                                  where s.household_id = e.household_id and s.status <> 'reversed'),
    'impact', impact);
end;
$$;

create function public.delete_expense(p_expense_id uuid, p_expected_version int default null)
returns int language plpgsql security definer set search_path = '' as $$
declare e public.expenses; m public.household_members; ne public.expenses; before_snap jsonb;
begin
  select * into e from public.expenses where id = p_expense_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(e.household_id);
  if not (private.is_admin_role(m.role) or e.created_by = m.user_id) then raise exception 'permission_denied'; end if;
  select * into e from public.expenses where id = p_expense_id for update;
  if e.deleted_at is not null or (p_expected_version is not null and e.version <> p_expected_version) then
    raise exception 'conflict';
  end if;
  before_snap := private.expense_snapshot(e.id);
  update public.expenses set deleted_at = now(), deleted_by = m.user_id, updated_by = m.user_id
   where id = e.id returning * into ne;
  perform private.emit_audit(e.household_id, m.id, 'expense', e.id, 'deleted', before_snap, private.expense_snapshot(e.id));
  perform private.emit_activity(e.household_id, m.id, 'expense.deleted', 'expense', e.id,
    jsonb_build_object('title', e.title, 'amount_minor', e.amount_minor, 'currency_code', e.currency_code),
    array(select member_id from public.expense_shares where expense_id = e.id) || e.paid_by_member_id);
  return ne.version;
end;
$$;

create function public.restore_expense(p_expense_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare e public.expenses; m public.household_members; ne public.expenses; before_snap jsonb;
begin
  select * into e from public.expenses where id = p_expense_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(e.household_id);
  if not (private.is_admin_role(m.role) or e.created_by = m.user_id) then raise exception 'permission_denied'; end if;
  select * into e from public.expenses where id = p_expense_id for update;
  if e.deleted_at is null then raise exception 'conflict'; end if;
  before_snap := private.expense_snapshot(e.id);
  update public.expenses set deleted_at = null, deleted_by = null, updated_by = m.user_id
   where id = e.id returning * into ne;
  perform private.emit_audit(e.household_id, m.id, 'expense', e.id, 'restored', before_snap, private.expense_snapshot(e.id));
  perform private.emit_activity(e.household_id, m.id, 'expense.restored', 'expense', e.id,
    jsonb_build_object('title', e.title, 'amount_minor', e.amount_minor, 'currency_code', e.currency_code),
    array(select member_id from public.expense_shares where expense_id = e.id) || e.paid_by_member_id);
  return ne.version;
end;
$$;
