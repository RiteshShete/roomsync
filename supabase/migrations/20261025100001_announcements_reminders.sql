-- Phase 7: announcement activity events and in-app chore reminders.
-- There is no push, email or scheduler: a "reminder" is an in-app activity event, created the first
-- time any member opens the app on a day it is due (see sync_chore_reminders).

-- ---------- announcements: events for direct writes ----------
create function private.announcement_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  if current_setting('roomsync.in_rpc', true) = 'on' then return null; end if;
  actor := private.my_member_id(new.household_id);

  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      perform private.emit_activity(new.household_id, actor, 'announcement.posted', 'announcement', new.id,
        jsonb_build_object('title', new.title), private.member_ids(new.household_id, actor));
    end if;
  elsif old.pinned_at is null and new.pinned_at is not null and new.deleted_at is null then
    perform private.emit_activity(new.household_id, actor, 'announcement.pinned', 'announcement', new.id,
      jsonb_build_object('title', new.title), private.member_ids(new.household_id, actor));
  end if;
  return null;
end;
$$;

create trigger announcements_activity
  after insert or update on public.announcements
  for each row execute function private.announcement_activity();

-- ---------- chore reminders ----------
-- One reminder per chore per day at most, on the due date and then every 3rd day while it is still
-- open. The unique index makes the function idempotent: many members opening the app on the same
-- day still produce one reminder.
create unique index activity_chore_reminder_once
  on public.activity_events (entity_id, (metadata ->> 'for_date'))
  where event_type = 'chore.reminder';

-- p_today is the caller's local date (the server has no time zone for a household); it must be
-- within a day of the server date so it can't be used to mint reminders for other days.
create function public.sync_chore_reminders(p_household_id uuid, p_today date default current_date)
returns int language plpgsql security definer set search_path = '' as $$
declare m public.household_members := private.ctx(p_household_id, false); n int;
begin
  if p_today is null or abs(p_today - current_date) > 1 then
    raise exception 'validation:today:out_of_range';
  end if;
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

revoke all on function private.announcement_activity() from public, anon, authenticated;
revoke all on function public.sync_chore_reminders(uuid, date) from public, anon;
grant execute on function public.sync_chore_reminders(uuid, date) to authenticated;
