-- SQL mirrors of src/domain/rotation.ts. Same vectors as the "rotation" tests in
-- src/domain/domain.test.ts; change one side only together with the other.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- nextOccurrence steps by frequency
select is(private.next_occurrence('2026-03-01', 'daily',    '2026-03-01'), '2026-03-02'::date, 'daily');
select is(private.next_occurrence('2026-03-01', 'weekly',   '2026-03-01'), '2026-03-08'::date, 'weekly');
select is(private.next_occurrence('2026-03-01', 'biweekly', '2026-03-01'), '2026-03-15'::date, 'biweekly');
select is(private.next_occurrence('2026-01-31', 'monthly',  '2026-01-31'), '2026-02-28'::date, 'monthly clamps to month end');
select is(private.next_occurrence('2028-01-31', 'monthly',  '2028-01-31'), '2028-02-29'::date, 'monthly clamps to Feb 29 in a leap year');
-- never in the past
select is(private.next_occurrence('2026-03-01', 'weekly',  '2026-03-20'), '2026-03-22'::date, 'weekly skips past dates');
select is(private.next_occurrence('2026-01-31', 'monthly', '2026-04-10'), '2026-04-30'::date, 'monthly skips past dates, anchored on the 31st');
select is(private.next_occurrence('2026-03-10', 'daily',   '2026-03-01'), '2026-03-11'::date, 'a future due date still advances by one step');
select throws_ok($$select private.next_occurrence('2026-03-01', 'yearly', '2026-03-01')$$, '23514', 'validation:recurrence_frequency:invalid', 'unknown frequency rejected');

-- nextAssignee
create temp table m (k text primary key, id uuid);
insert into m values ('a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('c', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), ('z', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
create function pg_temp.id(k text) returns uuid language sql as $$ select id from pg_temp.m where m.k = $1 $$;
create function pg_temp.ids(variadic ks text[]) returns uuid[] language sql as $$
  select coalesce(array_agg((select id from pg_temp.m where m.k = x) order by o), '{}') from unnest(ks) with ordinality t(x, o) $$;

select is((select assignee from private.next_assignee(pg_temp.ids('a', 'b', 'c'), pg_temp.id('a'), pg_temp.ids('a', 'b', 'c'))), pg_temp.id('b'), 'a -> b');
select is((select assignee from private.next_assignee(pg_temp.ids('a', 'b', 'c'), pg_temp.id('c'), pg_temp.ids('a', 'b', 'c'))), pg_temp.id('a'), 'wraps c -> a');
select is((select assignee from private.next_assignee(pg_temp.ids('a', 'b', 'c'), null, pg_temp.ids('a', 'b', 'c'))), pg_temp.id('a'), 'no current starts at the first');
select is((select assignee from private.next_assignee(pg_temp.ids('a', 'b'), pg_temp.id('z'), pg_temp.ids('a', 'b'))), pg_temp.id('a'), 'unknown current starts at the first');
select is((select assignee from private.next_assignee(pg_temp.ids('a', 'b', 'c'), pg_temp.id('a'), pg_temp.ids('a', 'c'))), pg_temp.id('c'), 'skips inactive b');
select is((select skipped from private.next_assignee(pg_temp.ids('a', 'b', 'c'), pg_temp.id('a'), pg_temp.ids('a', 'c'))), pg_temp.ids('b'), 'reports who was skipped');
select is((select assignee from private.next_assignee(pg_temp.ids('a', 'b'), pg_temp.id('a'), '{}')), null::uuid, 'nobody active -> null');
select is((select skipped from private.next_assignee(pg_temp.ids('a', 'b'), pg_temp.id('a'), '{}')), pg_temp.ids('b', 'a'), 'nobody active skips everyone');
select is((select assignee from private.next_assignee('{}', null, pg_temp.ids('a'))), null::uuid, 'empty rotation -> null');
select is((select assignee from private.next_assignee(pg_temp.ids('a', 'b'), pg_temp.id('a'), pg_temp.ids('a'))), pg_temp.id('a'), 'a lone active member can be picked again');

select * from finish();
rollback;
