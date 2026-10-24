-- Household isolation. Two households (A, B); user ua is in A and must never see or touch B.
-- Also covers: non-admin limits, a left member, a user with no household, and anon.
-- Treat any failure here as a stop-everything bug.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- Runs a DML statement as the caller (so RLS applies) and returns how many rows it changed.
create function public.test_rows_affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.test_rows_affected(text) to authenticated;

-- ===== fixtures (as postgres; RLS bypassed) =====
-- users: ua owner of A, uc member of A, ue LEFT member of A, ub owner of B, ub2 member of B, ud nobody
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ua@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'uc@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'ue@example.test'),
  ('b0000000-0000-4000-8000-000000000001', 'ub@example.test'),
  ('b0000000-0000-4000-8000-000000000002', 'ub2@example.test'),
  ('d0000000-0000-4000-8000-000000000001', 'ud@example.test');

insert into public.households (id, name, created_by) values
  ('1a000000-0000-4000-8000-000000000001', 'House A', 'a0000000-0000-4000-8000-000000000001'),
  ('1b000000-0000-4000-8000-000000000001', 'House B', 'b0000000-0000-4000-8000-000000000001');

insert into public.household_members (id, household_id, user_id, role, status, left_at) values
  ('aa000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner',  'active', null),
  ('aa000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'member', 'active', null),
  ('aa000000-0000-4000-8000-000000000003', '1a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'member', 'left',   now()),
  ('bb000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'owner',  'active', null),
  ('bb000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'member', 'active', null);

insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values
  ('e1000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'A rent', 600, 'INR', 'aa000000-0000-4000-8000-000000000001', current_date, 'equal', 'a0000000-0000-4000-8000-000000000001'),
  ('e2000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'B rent', 1000, 'INR', 'bb000000-0000-4000-8000-000000000001', current_date, 'equal', 'b0000000-0000-4000-8000-000000000001');
insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method) values
  ('e1000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 300, 'equal'),
  ('e1000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002', 300, 'equal'),
  ('e2000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', 500, 'equal'),
  ('e2000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000002', 500, 'equal');

insert into public.settlements (id, household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, recorded_by) values
  ('51000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-000000000001', 500, 'INR', current_date, 'b0000000-0000-4000-8000-000000000002');

insert into public.chores (id, household_id, title, assignee_member_id, created_by) values
  ('c1000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'A dishes',  'aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001', 'A trash',   'aa000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'B dishes',  'bb000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
insert into public.chore_completions (chore_id, household_id, chore_title, assignee_member_id, completed_by_member_id) values
  ('c2000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'B dishes', 'bb000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001');

insert into public.grocery_items (id, household_id, name, added_by_member_id) values
  ('91000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'A milk', 'aa000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'B milk', 'bb000000-0000-4000-8000-000000000001');

insert into public.announcements (id, household_id, title, body, created_by) values
  ('f1000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'A note by owner',  'body', 'a0000000-0000-4000-8000-000000000001'),
  ('f1000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001', 'A note by uc',     'body', 'a0000000-0000-4000-8000-000000000002'),
  ('f2000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'B note',           'body', 'b0000000-0000-4000-8000-000000000001');

insert into public.activity_events (id, household_id, actor_member_id, event_type, entity_type) values
  ('e3000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', 'expense.added', 'expense'),
  ('e4000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'expense.added', 'expense');
insert into public.activity_reads (member_id, event_id) values
  ('bb000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001'),
  ('aa000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001');
insert into public.audit_events (household_id, actor_member_id, entity_type, entity_id, action) values
  ('1b000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', 'expense', 'e2000000-0000-4000-8000-000000000001', 'create');
insert into public.invitations (household_id, created_by, code_hash, code_hint, expires_at) values
  ('1a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'hash-a', 'AB', now() + interval '1 day'),
  ('1b000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'hash-b', 'CD', now() + interval '1 day');
insert into public.invite_attempts (user_id, succeeded) values ('b0000000-0000-4000-8000-000000000001', false);
insert into public.member_move_out_disputes (member_id, note) values ('bb000000-0000-4000-8000-000000000001', 'B dispute');

-- fixtures themselves must satisfy every deferred invariant
set constraints all immediate;
select pass('fixtures satisfy all deferred constraints');

-- ===== ua (owner of A) =====
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- sanity: ua can see household A data (policies aren't simply denying everything)
select is((select count(*)::int from public.households), 1, 'ua sees exactly one household');
select is((select count(*)::int from public.household_members), 3, 'ua sees all three A member rows (incl. left, for history)');
select is((select count(*)::int from public.expenses), 1, 'ua sees A expense');
select is((select count(*)::int from public.expense_shares), 2, 'ua sees A expense shares');
select is((select count(*)::int from public.invitations), 1, 'owner sees A invitation');
select is((select count(*)::int from public.profiles), 3, 'ua sees profiles of A members only (ua, uc, ue)');

-- every table with a household_id column: zero rows of household B are visible
select is(
  (xpath('/row/c/text()', query_to_xml(
     format('select count(*) as c from public.%I where household_id = %L', c.relname, '1b000000-0000-4000-8000-000000000001'),
     false, true, '')))[1]::text::int,
  0, 'ua cannot see household B rows in ' || c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attname = 'household_id' and not a.attisdropped
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;

-- tables without household_id, and by-UUID guessing
select is((select count(*)::int from public.expense_shares where expense_id = 'e2000000-0000-4000-8000-000000000001'), 0, 'cannot read B shares by guessing the expense id');
select is((select count(*)::int from public.expenses where id = 'e2000000-0000-4000-8000-000000000001'), 0, 'cannot read B expense by guessing its id');
select is((select count(*)::int from public.settlements where id = '51000000-0000-4000-8000-000000000001'), 0, 'cannot read B settlement by id');
select is((select count(*)::int from public.activity_reads where member_id = 'bb000000-0000-4000-8000-000000000001'), 0, 'cannot read B activity_reads');
select is((select count(*)::int from public.activity_reads), 1, 'ua sees only their own activity_reads');
select is((select count(*)::int from public.notification_prefs where member_id = 'bb000000-0000-4000-8000-000000000001'), 0, 'cannot read B notification_prefs');
select is((select count(*)::int from public.notification_prefs), 1, 'ua sees only their own notification_prefs');
select is((select count(*)::int from public.member_move_out_disputes where member_id = 'bb000000-0000-4000-8000-000000000001'), 0, 'cannot read B move-out disputes');
select is((select count(*)::int from public.profiles where id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001')), 0, 'cannot read profiles of people outside shared households');
select throws_ok($$select 1 from public.invite_attempts$$, '42501', null, 'invite_attempts is not readable');
select throws_ok($$select code_hash from public.invitations$$, '42501', null, 'invitation code_hash is not readable');

-- cross-household writes on direct-write tables
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id) values ('1b000000-0000-4000-8000-000000000001', 'x', 'bb000000-0000-4000-8000-000000000001')$$, '42501', null, 'cannot insert grocery into B');
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id) values ('1a000000-0000-4000-8000-000000000001', 'x', 'aa000000-0000-4000-8000-000000000002')$$, '42501', null, 'cannot insert grocery as another member');
select lives_ok($$insert into public.grocery_items (household_id, name, added_by_member_id) values ('1a000000-0000-4000-8000-000000000001', 'eggs', 'aa000000-0000-4000-8000-000000000001')$$, 'can insert grocery into own household');
select throws_ok($$insert into public.chores (household_id, title, created_by) values ('1b000000-0000-4000-8000-000000000001', 'x', 'a0000000-0000-4000-8000-000000000001')$$, '42501', null, 'cannot insert chore into B');
select throws_ok($$insert into public.chores (household_id, title, created_by) values ('1a000000-0000-4000-8000-000000000001', 'x', 'a0000000-0000-4000-8000-000000000002')$$, '42501', null, 'cannot insert chore as someone else');
select throws_ok($$insert into public.chores (household_id, title, created_by, assignee_member_id) values ('1a000000-0000-4000-8000-000000000001', 'x', 'a0000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001')$$, '42501', null, 'cannot assign an own-household chore to a B member');
select throws_ok($$insert into public.chores (household_id, title, created_by, assignee_member_id) values ('1a000000-0000-4000-8000-000000000001', 'x', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000003')$$, '42501', null, 'cannot assign a chore to a member who has left');
select lives_ok($$insert into public.chores (household_id, title, created_by, assignee_member_id) values ('1a000000-0000-4000-8000-000000000001', 'sweep', 'a0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002')$$, 'can create chore in own household');
select throws_ok($$insert into public.announcements (household_id, title, body, created_by) values ('1b000000-0000-4000-8000-000000000001', 'x', 'y', 'a0000000-0000-4000-8000-000000000001')$$, '42501', null, 'cannot post announcement in B');
select lives_ok($$insert into public.announcements (household_id, title, body, created_by) values ('1a000000-0000-4000-8000-000000000001', 'hello', 'world', 'a0000000-0000-4000-8000-000000000001')$$, 'can post announcement in own household');

-- cross-household updates silently affect zero rows
select is(public.test_rows_affected($q$update public.grocery_items set name = 'hacked' where id = '92000000-0000-4000-8000-000000000001'$q$), 0, 'cannot update B grocery');
select is(public.test_rows_affected($q$update public.chores set title = 'hacked' where id = 'c2000000-0000-4000-8000-000000000001'$q$), 0, 'cannot update B chore');
select is(public.test_rows_affected($q$update public.announcements set title = 'hacked' where id = 'f2000000-0000-4000-8000-000000000001'$q$), 0, 'cannot update B announcement');
select is(public.test_rows_affected($q$update public.profiles set display_name = 'hacked' where id = 'b0000000-0000-4000-8000-000000000001'$q$), 0, 'cannot update B profile');
select is(public.test_rows_affected($q$update public.notification_prefs set quiet_enabled = false where member_id = 'bb000000-0000-4000-8000-000000000001'$q$), 0, 'cannot update B notification_prefs');
select is(public.test_rows_affected($q$update public.profiles set display_name = 'Me' where id = 'a0000000-0000-4000-8000-000000000001'$q$), 1, 'can update own profile');

-- RPC-only tables: no direct writes, even in the user's own household
select throws_ok($$insert into public.expenses (household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('1a000000-0000-4000-8000-000000000001', 'x', 100, 'INR', 'aa000000-0000-4000-8000-000000000001', current_date, 'equal', 'a0000000-0000-4000-8000-000000000001')$$, '42501', null, 'no direct insert into expenses');
select throws_ok($$update public.expenses set amount_minor = 1 where id = 'e1000000-0000-4000-8000-000000000001'$$, '42501', null, 'no direct update of expenses');
select throws_ok($$insert into public.settlements (household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, recorded_by) values ('1a000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002', 1, 'INR', current_date, 'a0000000-0000-4000-8000-000000000001')$$, '42501', null, 'no direct insert into settlements');
select throws_ok($$update public.households set name = 'x' where id = '1a000000-0000-4000-8000-000000000001'$$, '42501', null, 'no direct update of households');
select throws_ok($$update public.household_members set role = 'owner' where id = 'aa000000-0000-4000-8000-000000000002'$$, '42501', null, 'no direct role change');
select throws_ok($$insert into public.household_members (household_id, user_id) values ('1a000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001')$$, '42501', null, 'no direct member insert');
select throws_ok($$insert into public.activity_events (household_id, event_type, entity_type) values ('1a000000-0000-4000-8000-000000000001', 'x', 'y')$$, '42501', null, 'no direct activity insert');
select throws_ok($$insert into public.audit_events (household_id, entity_type, entity_id, action) values ('1a000000-0000-4000-8000-000000000001', 'x', gen_random_uuid(), 'y')$$, '42501', null, 'no direct audit insert');
select throws_ok($$update public.audit_events set action = 'z'$$, '42501', null, 'no direct audit update');
select throws_ok($$delete from public.expenses$$, '42501', null, 'no deletes on expenses');
select throws_ok($$delete from public.grocery_items$$, '42501', null, 'no hard deletes on grocery_items');
select throws_ok($$update public.chores set status = 'completed', completed_at = now() where id = 'c1000000-0000-4000-8000-000000000001'$$, '42501', null, 'chores cannot be completed by direct update');
select throws_ok($$update public.chores set household_id = '1b000000-0000-4000-8000-000000000001' where id = 'c1000000-0000-4000-8000-000000000001'$$, '42501', null, 'chores cannot be moved to another household');

-- ===== uc (plain member of A) =====
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.invitations), 0, 'plain member cannot see invitations');
select is(public.test_rows_affected($q$update public.announcements set title = 'edited' where id = 'f1000000-0000-4000-8000-000000000001'$q$), 0, 'member cannot edit someone else''s announcement');
select is(public.test_rows_affected($q$update public.announcements set title = 'mine' where id = 'f1000000-0000-4000-8000-000000000002'$q$), 1, 'member can edit own announcement');
select throws_ok($$update public.announcements set pinned_at = now() where id = 'f1000000-0000-4000-8000-000000000002'$$, 'P0001', 'permission_denied', 'member cannot pin');
select throws_ok($$insert into public.announcements (household_id, title, body, created_by, pinned_at) values ('1a000000-0000-4000-8000-000000000001', 'x', 'y', 'a0000000-0000-4000-8000-000000000002', now())$$, '42501', null, 'member cannot post a pinned announcement');
select is(public.test_rows_affected($q$update public.chores set title = 'edited' where id = 'c1000000-0000-4000-8000-000000000001'$q$), 0, 'member cannot edit a chore that is neither theirs nor created by them');
select is(public.test_rows_affected($q$update public.chores set title = 'trash!' where id = 'c1000000-0000-4000-8000-000000000002'$q$), 1, 'assignee can edit their chore');
select throws_ok($$update public.chores set status = 'cancelled' where id = 'c1000000-0000-4000-8000-000000000002'$$, '42501', null, 'assignee who is not creator cannot cancel');
select throws_ok($$update public.grocery_items set status = 'purchased', purchased_by_member_id = 'aa000000-0000-4000-8000-000000000001', purchased_at = now() where id = '91000000-0000-4000-8000-000000000001'$$, 'P0001', 'permission_denied', 'cannot mark purchased as another member');
select lives_ok($$update public.grocery_items set status = 'purchased', purchased_by_member_id = 'aa000000-0000-4000-8000-000000000002', purchased_at = now() where id = '91000000-0000-4000-8000-000000000001'$$, 'can mark purchased as self');

-- ===== ue (LEFT member of A) =====
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.households), 0, 'left member cannot see the household');
select is((select count(*)::int from public.household_members), 0, 'left member cannot see members');
select is((select count(*)::int from public.expenses), 0, 'left member cannot see expenses');
select is((select count(*)::int from public.chores), 0, 'left member cannot see chores');
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id) values ('1a000000-0000-4000-8000-000000000001', 'x', 'aa000000-0000-4000-8000-000000000003')$$, '42501', null, 'left member cannot write');

-- ===== ud (no household) =====
reset role;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.households), 0, 'user without household sees no households');
select is((select count(*)::int from public.expenses), 0, 'user without household sees no expenses');
select is((select count(*)::int from public.profiles), 1, 'user without household sees only their own profile');

-- ===== anon (unauthenticated) =====
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', c.relname), '42501', null, 'anon cannot read ' || c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id) values ('1a000000-0000-4000-8000-000000000001', 'x', 'aa000000-0000-4000-8000-000000000001')$$, '42501', null, 'anon cannot insert');

-- ===== archived household blocks direct writes =====
reset role;
update public.households set status = 'archived' where id = '1a000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id) values ('1a000000-0000-4000-8000-000000000001', 'late', 'aa000000-0000-4000-8000-000000000001')$$, '42501', null, 'archived household: cannot add grocery');
select throws_ok($$insert into public.chores (household_id, title, created_by) values ('1a000000-0000-4000-8000-000000000001', 'late', 'a0000000-0000-4000-8000-000000000001')$$, '42501', null, 'archived household: cannot add chore');
select throws_ok($$insert into public.announcements (household_id, title, body, created_by) values ('1a000000-0000-4000-8000-000000000001', 'late', 'x', 'a0000000-0000-4000-8000-000000000001')$$, '42501', null, 'archived household: cannot post');
select is((select count(*)::int from public.expenses), 1, 'archived household is still readable');

-- ===== B data untouched =====
reset role;
select is((select name from public.grocery_items where id = '92000000-0000-4000-8000-000000000001'), 'B milk', 'B grocery unchanged');
select is((select title from public.chores where id = 'c2000000-0000-4000-8000-000000000001'), 'B dishes', 'B chore unchanged');
select is((select title from public.announcements where id = 'f2000000-0000-4000-8000-000000000001'), 'B note', 'B announcement unchanged');
select is((select display_name from public.profiles where id = 'b0000000-0000-4000-8000-000000000001'), 'ub', 'B profile unchanged');

select * from finish();
rollback;
