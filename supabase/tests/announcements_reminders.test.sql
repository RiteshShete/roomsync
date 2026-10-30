begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ===== shared fixture =====
-- House A: ua owner, ub admin, uc member, ud member.  House B: uf owner.  ue: user with no household.
-- Everything is created through the real RPCs, logged in as each user.
create table public.t_ctx (k text primary key, v text);
grant all on public.t_ctx to authenticated;
create function public.t(k text) returns uuid language sql stable as $$ select v::uuid from public.t_ctx where t_ctx.k = $1 $$;
create function public.tt(k text) returns text language sql stable as $$ select v from public.t_ctx where t_ctx.k = $1 $$;
create function public.test_login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  -- Each real request is its own transaction, so the "inside an RPC" flag never leaks between requests.
  -- pgTAP runs everything in one transaction, so reset it whenever a new request is simulated.
  perform set_config('roomsync.in_rpc', '', true);
end $$;
create function public.test_logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('roomsync.in_rpc', '', true);
end $$;
create function public.test_rows_affected(q text) returns int language plpgsql as $$ declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;
grant execute on function public.t(text), public.tt(text), public.test_login(uuid), public.test_logout(), public.test_rows_affected(text) to authenticated;

insert into public.t_ctx values
  ('ua', 'a0000000-0000-4000-8000-000000000001'), ('ub', 'a0000000-0000-4000-8000-000000000002'),
  ('uc', 'a0000000-0000-4000-8000-000000000003'), ('ud', 'a0000000-0000-4000-8000-000000000004'),
  ('ue', 'e0000000-0000-4000-8000-000000000001'), ('uf', 'f0000000-0000-4000-8000-000000000001');
insert into auth.users (id, email) select v::uuid, k || '@example.test' from public.t_ctx;

select public.test_login(public.t('ua'));
insert into public.t_ctx select 'h', public.create_household('House A')::text;
insert into public.t_ctx select 'code', public.create_invite(public.t('h'), 24, null) ->> 'code';
select public.test_login(public.t('ub')); select public.join_household(public.tt('code'));
select public.test_login(public.t('uc')); select public.join_household(public.tt('code'));
select public.test_login(public.t('ud')); select public.join_household(public.tt('code'));
select public.test_login(public.t('uf'));
insert into public.t_ctx select 'hb', public.create_household('House B')::text;
select public.test_logout();
insert into public.t_ctx
  select 'm_' || x.k, hm.id::text from public.t_ctx x
  join public.household_members hm on hm.user_id = x.v::uuid where x.k in ('ua', 'ub', 'uc', 'ud', 'uf');
select public.test_login(public.t('ua'));
select public.set_member_role(public.t('m_ub'), 'admin');
select public.test_logout();
-- ===== end fixture =====


-- Phase 7: announcement events and in-app chore reminders.
create function public.ev_n(p_entity uuid, p_type text) returns int language sql stable as $$
  select count(*)::int from public.activity_events where entity_id = p_entity and event_type = p_type $$;
create function public.ev_rec(p_entity uuid, p_type text) returns uuid[] language sql stable as $$
  select array(select x from unnest(recipient_member_ids) x order by x) from public.activity_events where entity_id = p_entity and event_type = p_type limit 1 $$;
create function public.sorted(a uuid[]) returns uuid[] language sql immutable as $$ select array(select x from unnest(a) x order by x) $$;
grant execute on function public.ev_n(uuid, text), public.ev_rec(uuid, text), public.sorted(uuid[]) to authenticated;

-- ===== announcements =====
select public.test_login(public.t('uc'));
select lives_ok($$with a as (insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), 'Water off', 'Tuesday 10-12', public.t('uc')) returning id) insert into public.t_ctx select 'an1', id::text from a$$, 'a member posts an announcement');
select is(public.ev_n(public.t('an1'), 'announcement.posted'), 1, 'posting emits one event');
select is(public.ev_rec(public.t('an1'), 'announcement.posted'), public.sorted(array[public.t('m_ua'), public.t('m_ub'), public.t('m_ud')]), 'everyone except the author is notified');
select is((select metadata from public.activity_events where entity_id = public.t('an1') and event_type = 'announcement.posted'), '{"title": "Water off"}'::jsonb, 'metadata holds the title only, never the message');
select is((select actor_member_id from public.activity_events where entity_id = public.t('an1')), public.t('m_uc'), 'actor is the author');

select lives_ok($$update public.announcements set title = 'Water off (updated)' where id = public.t('an1')$$, 'author edits it');
select is(public.ev_n(public.t('an1'), 'announcement.posted'), 1, 'an edit does not re-announce');

select public.test_login(public.t('ub'));
select lives_ok($$update public.announcements set pinned_at = now() where id = public.t('an1')$$, 'an admin pins it');
select is(public.ev_n(public.t('an1'), 'announcement.pinned'), 1, 'pinning emits one event');
select is(public.ev_rec(public.t('an1'), 'announcement.pinned'), public.sorted(array[public.t('m_ua'), public.t('m_uc'), public.t('m_ud')]), 'pin notifies everyone but the admin who pinned');
select lives_ok($$update public.announcements set title = 'Water off (again)' where id = public.t('an1')$$, 'admin edits');
select is(public.ev_n(public.t('an1'), 'announcement.pinned'), 1, 'editing a pinned announcement does not re-notify');
select lives_ok($$update public.announcements set deleted_at = now() where id = public.t('an1')$$, 'admin deletes (soft)');
select is(public.ev_n(public.t('an1'), 'announcement.pinned'), 1, 'delete emits nothing');


-- ===== chore reminders =====
select public.test_logout();
update public.households set chore_reminders_enabled = true where id = public.t('h');
insert into public.chores (household_id, title, created_by, assignee_member_id, due_date) values
  (public.t('h'), 'R today', public.t('ua'), public.t('m_uc'), current_date),
  (public.t('h'), 'R overdue 3', public.t('ua'), public.t('m_uc'), current_date - 3),
  (public.t('h'), 'R overdue 2', public.t('ua'), public.t('m_ud'), current_date - 2),
  (public.t('h'), 'R tomorrow', public.t('ua'), public.t('m_uc'), current_date + 1),
  (public.t('h'), 'R undated', public.t('ua'), public.t('m_uc'), null),
  (public.t('h'), 'R unassigned', public.t('ua'), null, current_date);
insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, status) values
  (public.t('h'), 'R cancelled', public.t('ua'), public.t('m_uc'), current_date, 'cancelled');

select public.test_login(public.t('ud'));
select is(public.sync_chore_reminders(public.t('h')), 2, 'due today and 3 days overdue are reminded; 2 days overdue, tomorrow, undated, unassigned and cancelled are not');
select is(public.sync_chore_reminders(public.t('h')), 0, 'running it again the same day creates nothing (idempotent)');
select public.test_login(public.t('uc'));
select is(public.sync_chore_reminders(public.t('h')), 0, 'another member opening the app does not duplicate');
select is((select count(*)::int from public.activity_events where event_type = 'chore.reminder'), 2, 'exactly two reminder events exist');
select is((select array_agg(recipient_member_ids[1]) from public.activity_events where event_type = 'chore.reminder'), array[public.t('m_uc'), public.t('m_uc')], 'each reminder goes to the assignee only');
select is((select count(*)::int from public.activity_events where event_type = 'chore.reminder' and (metadata ->> 'overdue')::boolean), 1, 'the overdue one is marked overdue');
select is((select array_agg(k order by k) from jsonb_object_keys((select metadata from public.activity_events where event_type = 'chore.reminder' limit 1)) k), array['due_date', 'for_date', 'overdue', 'title'], 'metadata is title and dates only');
select is(public.sync_chore_reminders(public.t('h'), current_date + 1), 2, 'the next day: the chore now 3 days overdue and the one due that day are reminded; the others are not');
select throws_ok($$select public.sync_chore_reminders(public.t('h'), current_date + 5)$$, 'P0001', 'validation:today:out_of_range', 'a date more than a day away is rejected');
select throws_ok($$select public.sync_chore_reminders(public.t('h'), null)$$, 'P0001', 'validation:today:out_of_range', 'a null date is rejected');

-- the household switch
select public.test_logout();
update public.households set chore_reminders_enabled = false where id = public.t('h');
select public.test_login(public.t('uc'));
select is(public.sync_chore_reminders(public.t('h'), current_date - 1), 0, 'reminders switched off: nothing is created');

-- a member who has left is not reminded; archived households are silent
select public.test_logout();
update public.households set chore_reminders_enabled = true where id = public.t('h');
update public.household_members set status = 'left', left_at = now() where id = public.t('m_ud');
select public.test_login(public.t('uc'));
select is(public.sync_chore_reminders(public.t('h'), current_date - 1), 0, 'yesterday: nothing due that is assigned to an active member on the beat');
select public.test_logout();
update public.households set status = 'archived' where id = public.t('h');
select public.test_login(public.t('uc'));
select is(public.sync_chore_reminders(public.t('h'), current_date + 1), 0, 'archived household: silent');

-- isolation
select public.test_login(public.t('uf'));
select throws_ok($$select public.sync_chore_reminders(public.t('h'))$$, 'P0001', 'not_found', 'a non-member cannot trigger or learn about reminders');
select public.test_login(public.t('ue'));
select is((select count(*)::int from public.activity_events), 0, 'an outsider sees no events');
select public.test_logout();
set role anon;
select throws_ok($$select public.sync_chore_reminders('00000000-0000-0000-0000-000000000000')$$, '42501', null, 'anon cannot execute it');
reset role;

-- ===== edge cases =====
-- the live channel only works if every table the app subscribes to is published
select is((select array_agg(tablename::text order by tablename) from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public'
              and tablename in ('expenses', 'settlements', 'chores', 'grocery_items', 'announcements', 'activity_events', 'chat_messages')),
          array['activity_events', 'announcements', 'chat_messages', 'chores', 'expenses', 'grocery_items', 'settlements'],
          'every table the UI subscribes to is in the realtime publication');

update public.households set status = 'active', chore_reminders_enabled = true where id = public.t('h');
update public.household_members set status = 'active', left_at = null where id = public.t('m_ud');

select public.test_login(public.t('uc'));
select throws_ok($$insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), '   ', 'x', public.t('uc'))$$, '23514', null, 'a blank title is refused by the database');
select throws_ok($$insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), 'x', '   ', public.t('uc'))$$, '23514', null, 'a blank message is refused by the database');
select throws_ok(format($$insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), 'x', %L, public.t('uc'))$$, repeat('x', 4001)), '23514', null, 'a message over 4000 characters is refused');
select throws_ok(format($$insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), %L, 'x', public.t('uc'))$$, repeat('x', 121)), '23514', null, 'a title over 120 characters is refused');
select throws_ok($$insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), 'spoof', 'x', public.t('ua'))$$, '42501', null, 'cannot post as someone else');
select lives_ok($$insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), '<script>alert(1)</script>', 'a ''quoted'' message', public.t('uc'))$$, 'markup and quotes are stored as plain text');

-- the unique index is what makes reminders idempotent, even under a race
select public.test_logout();
select throws_ok($$insert into public.activity_events (household_id, event_type, entity_type, entity_id, metadata, recipient_member_ids)
  select household_id, 'chore.reminder', 'chore', entity_id, metadata, recipient_member_ids from public.activity_events where event_type = 'chore.reminder' limit 1$$,
  '23505', null, 'a duplicate reminder for the same chore and day cannot exist');

-- a chore whose assignee is not an active member gets no reminder; 'leaving' members still do
update public.household_members set status = 'leaving', move_out_effective_date = current_date + 5 where id = public.t('m_ud');
insert into public.chores (household_id, title, created_by, assignee_member_id, due_date) values (public.t('h'), 'Leaving person chore', public.t('ua'), public.t('m_ud'), current_date + 10);
select public.test_login(public.t('uc'));
select is(public.sync_chore_reminders(public.t('h'), current_date + 1), 0, 'nothing newly due on the beat for the leaving member yet');

-- ===== bounded storage: short-lived rows are pruned, history is not =====
select public.test_logout();
insert into public.activity_events (household_id, event_type, entity_type, metadata, recipient_member_ids, created_at) values
  (public.t('h'), 'old.test', 'x', '{}', array[public.t('m_uc')], now() - interval '100 days'),
  (public.t('h'), 'recent.test', 'x', '{}', array[public.t('m_uc')], now() - interval '89 days'),
  (public.t('hb'), 'other.old.test', 'x', '{}', '{}', now() - interval '100 days');
insert into public.activity_reads (member_id, event_id) select public.t('m_uc'), id from public.activity_events where event_type = 'old.test';
insert into public.invite_attempts (user_id, attempted_at, succeeded) values (public.t('ue'), now() - interval '2 days', false), (public.t('ue'), now() - interval '10 minutes', false);
insert into public.audit_events (household_id, entity_type, entity_id, action, created_at) values (public.t('h'), 'expense', gen_random_uuid(), 'old.audit', now() - interval '400 days');

select public.test_login(public.t('uc'));
select lives_ok($$select public.sync_chore_reminders(public.t('h'))$$, 'the daily sync runs');
select public.test_logout();
select is((select count(*)::int from public.activity_events where event_type = 'old.test'), 0, 'activity older than 90 days is pruned');
select is((select count(*)::int from public.activity_reads where event_id not in (select id from public.activity_events)), 0, 'and its read marks go with it');
select is((select count(*)::int from public.activity_events where event_type = 'recent.test'), 1, 'activity inside 90 days is kept');
select is((select count(*)::int from public.activity_events where event_type = 'other.old.test'), 1, 'another household''s events are not touched by this household''s sync');
select is((select count(*)::int from public.invite_attempts where user_id = public.t('ue') and attempted_at < now() - interval '1 day'), 0, 'invite attempts older than a day are pruned');
select is((select count(*)::int from public.invite_attempts where user_id = public.t('ue')), 1, 'a recent attempt (still inside the throttle window) is kept');
select is((select count(*)::int from public.audit_events where action = 'old.audit'), 1, 'audit history is never pruned');

select * from finish();
rollback;
