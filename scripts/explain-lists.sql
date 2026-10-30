-- Query plans for the lists the app loads, on realistic volumes. Everything runs inside one transaction
-- that is ROLLED BACK, so the local database is left exactly as it was.
--
--   npm run db:explain
--
-- It loads 30,000 expenses, 60,000 activity events and a few thousand of everything else into a household
-- (plus the same amount of noise in a second household), then runs EXPLAIN ANALYZE for each query exactly
-- as the app issues it, as a signed-in member (row-level security on). Read the output for "Seq Scan" on a
-- big table: there should be none. scripts/explain-check.mjs does that check automatically.

\set ON_ERROR_STOP on
begin;
set constraints all deferred;

create temp table pick as
  select h.id as hid,
         (select m.id from public.household_members m where m.household_id = h.id order by m.joined_at limit 1) as mid,
         (select m.user_id from public.household_members m where m.household_id = h.id order by m.joined_at limit 1) as uid
    from public.households h order by h.created_at limit 2;

insert into public.expenses (household_id, title, amount_minor, currency_code, category, paid_by_member_id, expense_date, split_method, created_by, created_at)
select p.hid, 'Bulk ' || g, 1000 + g % 9000, 'INR', (array['food','rent','utilities','other'])[1 + g % 4], p.mid, current_date - (g % 700), 'equal', p.uid, now() - (g || ' minutes')::interval
  from pick p, generate_series(1, 30000) g;

insert into public.activity_events (household_id, actor_member_id, event_type, entity_type, metadata, recipient_member_ids, created_at)
select p.hid, p.mid, 'expense.added', 'expense', '{}', array[p.mid], now() - (g || ' minutes')::interval
  from pick p, generate_series(1, 60000) g;

insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, status, completed_at, completed_by, created_at)
select p.hid, 'Chore ' || g, p.uid, p.mid, current_date + (g % 90),
       case when g % 10 = 0 then 'open' else 'completed' end,
       case when g % 10 = 0 then null else now() - (g || ' minutes')::interval end,
       case when g % 10 = 0 then null else p.uid end,
       now() - (g || ' minutes')::interval
  from pick p, generate_series(1, 5000) g;

insert into public.grocery_items (household_id, name, added_by_member_id, created_at)
select p.hid, 'Item ' || g, p.mid, now() - (g || ' minutes')::interval from pick p, generate_series(1, 3000) g;

insert into public.announcements (household_id, title, body, created_by, created_at)
select p.hid, 'Notice ' || g, 'Body', p.uid, now() - (g || ' minutes')::interval from pick p, generate_series(1, 2000) g;

insert into public.audit_events (household_id, entity_type, entity_id, action, created_at)
select p.hid, 'expense', gen_random_uuid(), 'edit', now() - (g || ' minutes')::interval from pick p, generate_series(1, 20000) g;

analyze public.expenses;
analyze public.activity_events;
analyze public.chores;
analyze public.grocery_items;
analyze public.announcements;
analyze public.audit_events;

select hid, mid, uid from pick order by hid limit 1 \gset
select entity_id as eid from public.audit_events where household_id = :'hid' limit 1 \gset

-- run as the signed-in member, so row-level security is part of the plan
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);

\echo '=== expenses: first page (newest first)'
explain (analyze, buffers, costs off, summary on)
select id, title, amount_minor, expense_date, created_at from public.expenses
 where household_id = :'hid' and deleted_at is null order by expense_date desc, created_at desc limit 21 offset 0;

\echo '=== expenses: a deep page'
explain (analyze, buffers, costs off, summary on)
select id, title, amount_minor, expense_date, created_at from public.expenses
 where household_id = :'hid' and deleted_at is null order by expense_date desc, created_at desc limit 21 offset 1000;

\echo '=== expenses: filtered by category and date range'
explain (analyze, buffers, costs off, summary on)
select id, title, amount_minor, expense_date, created_at from public.expenses
 where household_id = :'hid' and deleted_at is null and category = 'food' and expense_date >= current_date - 90
 order by expense_date desc, created_at desc limit 21 offset 0;

\echo '=== activity: latest 100 for the household'
explain (analyze, buffers, costs off, summary on)
select id, event_type, created_at from public.activity_events where household_id = :'hid' order by created_at desc limit 100;

\echo '=== chores: open, by due date'
explain (analyze, buffers, costs off, summary on)
select id, title, due_date from public.chores where household_id = :'hid' and status = 'open' order by due_date asc nulls last, created_at asc limit 300;

\echo '=== chores: latest completed'
explain (analyze, buffers, costs off, summary on)
select id, title, completed_at from public.chores where household_id = :'hid' and status = 'completed' order by completed_at desc limit 50;

\echo '=== groceries: the list'
explain (analyze, buffers, costs off, summary on)
select id, name from public.grocery_items where household_id = :'hid' and deleted_at is null order by created_at asc limit 500;

\echo '=== announcements: pinned first'
explain (analyze, buffers, costs off, summary on)
select id, title from public.announcements where household_id = :'hid' and deleted_at is null
 order by pinned_at desc nulls last, created_at desc limit 200;

\echo '=== history of one expense'
explain (analyze, buffers, costs off, summary on)
select id, action, created_at from public.audit_events
 where entity_type = 'expense' and entity_id = :'eid' order by created_at desc limit 50;

rollback;
