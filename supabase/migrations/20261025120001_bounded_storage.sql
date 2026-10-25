-- Keep storage small (the project runs on a small free database). RoomSync stores no cached or
-- derived copies of anything (balances are computed when asked), so the only tables that grow by
-- themselves are short-lived by nature:
--   * activity_events (and, by cascade, activity_reads): notifications, kept 90 days
--   * invite_attempts: the guess-throttle only looks back one hour, kept one day
-- Financial and audit history (expenses, settlements, audit_events) is never pruned.
-- Pruning runs a little at a time, inside the daily reminder sync, so no scheduler is needed.

create function private.prune_old_rows(p_hid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.activity_events
   where id in (select id from public.activity_events
                 where household_id = p_hid and created_at < now() - interval '90 days'
                 order by created_at limit 500);
  delete from public.invite_attempts
   where id in (select id from public.invite_attempts
                 where attempted_at < now() - interval '1 day'
                 order by attempted_at limit 500);
end;
$$;

create or replace function public.sync_chore_reminders(p_household_id uuid, p_today date default current_date)
returns int language plpgsql security definer set search_path = '' as $$
declare m public.household_members := private.ctx(p_household_id, false); n int;
begin
  if p_today is null or abs(p_today - current_date) > 1 then
    raise exception 'validation:today:out_of_range';
  end if;
  perform private.prune_old_rows(p_household_id);
  if not exists (
    select 1 from public.households h
     where h.id = p_household_id and h.status = 'active' and h.chore_reminders_enabled
  ) then
    return 0;
  end if;

  insert into public.activity_events
    (household_id, actor_member_id, event_type, entity_type, entity_id, metadata, recipient_member_ids)
  select c.household_id, null, 'chore.reminder', 'chore', c.id,
         jsonb_build_object('title', c.title, 'due_date', c.due_date, 'for_date', p_today, 'overdue', c.due_date < p_today),
         array[c.assignee_member_id]
    from public.chores c
    join public.household_members a on a.id = c.assignee_member_id and a.status <> 'left'
   where c.household_id = p_household_id and c.status = 'open'
     and c.due_date is not null and c.due_date <= p_today
     and (p_today - c.due_date) % 3 = 0
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function private.prune_old_rows(uuid) from public, anon, authenticated;
