-- Task category and priority (from the Tasks design). Both are plain labels on the chore row, so the
-- existing RLS and the version-guarded update already cover them. The next occurrence of a recurring
-- chore copies them, so complete_chore is redefined below with only that one change.

alter table public.chores
  add column category text check (category is null or category in ('cleaning', 'cooking', 'shopping', 'laundry', 'repairs', 'other')),
  add column priority text not null default 'medium' check (priority in ('low', 'medium', 'high'));

create or replace function public.complete_chore(p_chore_id uuid, p_expected_version int default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.chores; m public.household_members;
  next_id uuid; next_assignee uuid; skp uuid[] := '{}'; next_due date; active_ids uuid[]; admin_ids uuid[];
  recipients uuid[];
begin
  select * into c from public.chores where id = p_chore_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(c.household_id);
  select * into c from public.chores where id = p_chore_id for update;
  if c.status <> 'open' or (p_expected_version is not null and c.version <> p_expected_version) then
    raise exception 'conflict';
  end if;
  if not (private.is_admin_role(m.role) or c.created_by = m.user_id
          or c.assignee_member_id = m.id or c.assignee_member_id is null) then
    raise exception 'permission_denied';
  end if;

  update public.chores set status = 'completed', completed_at = now(), completed_by = m.user_id where id = c.id;
  insert into public.chore_completions (chore_id, household_id, chore_title, assignee_member_id,
                                        completed_by_member_id, due_date)
  values (c.id, c.household_id, c.title, c.assignee_member_id, m.id, c.due_date);

  if c.recurrence_frequency is not null then
    next_due := private.next_occurrence(c.due_date, c.recurrence_frequency, current_date);
    active_ids := array(select id from public.household_members where household_id = c.household_id and status = 'active');
    if c.rotation_member_ids is not null then
      select a.assignee, a.skipped into next_assignee, skp
        from private.next_assignee(c.rotation_member_ids, c.assignee_member_id, active_ids) a;
    elsif c.assignee_member_id is not null
          and private.is_assignable_member(c.assignee_member_id, c.household_id) then
      next_assignee := c.assignee_member_id;
    end if;

    insert into public.chores (household_id, title, description, assignee_member_id, due_date,
                               recurrence_frequency, rotation_member_ids, created_by, category, priority)
    values (c.household_id, c.title, c.description, next_assignee, next_due,
            c.recurrence_frequency, c.rotation_member_ids, c.created_by, c.category, c.priority)
    returning id into next_id;
    update public.chores set spawned_next_id = next_id where id = c.id;

    if next_assignee is null and (c.rotation_member_ids is not null or c.assignee_member_id is not null) then
      admin_ids := private.member_ids(c.household_id, null, array['owner', 'admin']);
      perform private.emit_activity(c.household_id, null, 'chore.needs_assignee', 'chore', next_id,
        jsonb_build_object('title', c.title), admin_ids);
    elsif next_assignee is not null then
      perform private.emit_activity(c.household_id, m.id, 'chore.assigned', 'chore', next_id,
        jsonb_build_object('title', c.title, 'due_date', next_due, 'skipped_member_ids', to_jsonb(skp)),
        array[next_assignee]);
    end if;
  end if;

  recipients := array(select i from unnest(array[c.assignee_member_id,
     (select mm.id from public.household_members mm
       where mm.household_id = c.household_id and mm.user_id = c.created_by and mm.status <> 'left'
       order by mm.joined_at desc limit 1)]) i where i is not null);
  perform private.emit_activity(c.household_id, m.id, 'chore.completed', 'chore', c.id,
    jsonb_build_object('title', c.title, 'next_chore_id', next_id), recipients);

  return jsonb_build_object('next_chore_id', next_id, 'next_assignee_member_id', next_assignee,
                            'skipped_member_ids', to_jsonb(skp));
end;
$$;

-- Writes go through column-level grants (see 20261024100008_grants.sql), so the new columns need their own.
grant insert (category, priority) on public.chores to authenticated;
grant update (category, priority) on public.chores to authenticated;
