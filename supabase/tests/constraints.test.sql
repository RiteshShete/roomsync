-- Database invariants. Runs as postgres with deferred constraints forced immediate, so a statement
-- that breaks an invariant fails right there. Expense + shares are inserted in one statement
-- (CTE) because that is how the RPCs will write them.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'a@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'b@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'c@example.test'),
  ('b0000000-0000-4000-8000-000000000001', 'x@example.test');
insert into public.households (id, name, created_by) values
  ('1a000000-0000-4000-8000-000000000001', 'House A', 'a0000000-0000-4000-8000-000000000001'),
  ('1b000000-0000-4000-8000-000000000001', 'House X', 'b0000000-0000-4000-8000-000000000001'),
  ('1c000000-0000-4000-8000-000000000001', 'Empty money', 'b0000000-0000-4000-8000-000000000001');
set constraints all immediate;
-- owner first (a household with members must always have an owner)
insert into public.household_members (id, household_id, user_id, role) values
  ('aa000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('aa000000-0000-4000-8000-000000000002', '1a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'member'),
  ('aa000000-0000-4000-8000-000000000003', '1a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'member'),
  ('bb000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'owner');

-- ===== expenses: amount =====
select throws_ok($$insert into public.expenses (household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('1a000000-0000-4000-8000-000000000001','t',0,'INR','aa000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001')$$, '23514', null, 'amount 0 rejected');
select throws_ok($$insert into public.expenses (household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('1a000000-0000-4000-8000-000000000001','t',-5,'INR','aa000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001')$$, '23514', null, 'negative amount rejected');
select throws_ok($$insert into public.expenses (household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('1a000000-0000-4000-8000-000000000001','t',10000000001,'INR','aa000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001')$$, '23514', null, 'amount above 1e8 major units rejected');
select throws_ok($$insert into public.expenses (household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('1a000000-0000-4000-8000-000000000001','t',100,'USD','aa000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001')$$, '23514', 'validation:currency_code:mismatch', 'expense currency must match the household');
select throws_ok($$insert into public.expenses (household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('1a000000-0000-4000-8000-000000000001','t',100,'INR','bb000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001')$$, '23503', null, 'payer from another household rejected');

-- ===== valid splits =====
select lives_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('e1000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','Rent',100000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'equal' from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 33334), ('aa000000-0000-4000-8000-000000000002', 33333), ('aa000000-0000-4000-8000-000000000003', 33333)) s(m, a)$$,
  '₹1,000 equal split 333.34/333.33/333.33 is accepted');
select lives_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('e2000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','Wifi',100000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'percentage','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method, percent_bp)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'percentage', s.bp from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 50000, 5000), ('aa000000-0000-4000-8000-000000000002', 30000, 3000), ('aa000000-0000-4000-8000-000000000003', 20000, 2000)) s(m, a, bp)$$,
  '50/30/20 percentage split is accepted');
select lives_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values ('e3000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','Custom',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'custom','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'custom' from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 900), ('aa000000-0000-4000-8000-000000000002', 100)) s(m, a)$$,
  'custom split that sums to the total is accepted');

-- ===== invalid splits =====
select throws_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values (gen_random_uuid(),'1a000000-0000-4000-8000-000000000001','t',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'custom','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'custom' from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 500), ('aa000000-0000-4000-8000-000000000002', 400)) s(m, a)$$,
  '23514', 'validation:shares:sum_mismatch', 'share-sum mismatch rejected');
select throws_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values (gen_random_uuid(),'1a000000-0000-4000-8000-000000000001','t',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'custom','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'custom' from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 1100), ('aa000000-0000-4000-8000-000000000002', -100)) s(m, a)$$,
  '23514', null, 'negative share rejected');
select throws_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values (gen_random_uuid(),'1a000000-0000-4000-8000-000000000001','t',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'custom','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'custom' from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 500), ('bb000000-0000-4000-8000-000000000001', 500)) s(m, a)$$,
  '23503', null, 'participant from another household rejected');
select throws_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values (gen_random_uuid(),'1a000000-0000-4000-8000-000000000001','t',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'equal' from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 600), ('aa000000-0000-4000-8000-000000000002', 400)) s(m, a)$$,
  '23514', 'validation:shares:equal_spread', 'equal split with spread above 1 minor unit rejected');
select throws_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values (gen_random_uuid(),'1a000000-0000-4000-8000-000000000001','t',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'percentage','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method, percent_bp)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'percentage', s.bp from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 500, 5000), ('aa000000-0000-4000-8000-000000000002', 500, 4000)) s(m, a, bp)$$,
  '23514', 'validation:shares:percent_total', 'percentages not totalling 10000bp rejected');
select throws_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values (gen_random_uuid(),'1a000000-0000-4000-8000-000000000001','t',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'percentage','a0000000-0000-4000-8000-000000000001') returning id)
  insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method, percent_bp)
  select e.id, '1a000000-0000-4000-8000-000000000001', s.m, s.a, 'percentage', s.bp from e, (values ('aa000000-0000-4000-8000-000000000001'::uuid, 900, 5000), ('aa000000-0000-4000-8000-000000000002', 100, 5000)) s(m, a, bp)$$,
  '23514', 'validation:shares:percent_rounding', 'percentage shares that do not match their percentages rejected');
select throws_ok($$insert into public.expense_shares (expense_id, household_id, member_id, share_amount_minor, split_method, percent_bp) values ('e3000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000003',0,'custom',500)$$, '23514', null, 'percent_bp only allowed on percentage splits');
select throws_ok($$delete from public.expense_shares where expense_id = 'e3000000-0000-4000-8000-000000000001' and member_id = 'aa000000-0000-4000-8000-000000000002'$$, '23514', 'validation:shares:sum_mismatch', 'removing a share so the sum no longer matches is rejected');
select throws_ok($$update public.expenses set amount_minor = 2000 where id = 'e3000000-0000-4000-8000-000000000001'$$, '23514', 'validation:shares:sum_mismatch', 'changing the amount without changing shares is rejected');
select throws_ok($$with e as (insert into public.expenses (id, household_id, title, amount_minor, currency_code, paid_by_member_id, expense_date, split_method, created_by) values (gen_random_uuid(),'1a000000-0000-4000-8000-000000000001','no shares',1000,'INR','aa000000-0000-4000-8000-000000000001',current_date,'equal','a0000000-0000-4000-8000-000000000001') returning id) select 1 from e$$,
  '23514', 'validation:shares:sum_mismatch', 'an expense with no shares is rejected');

-- ===== memberships =====
select throws_ok($$insert into public.household_members (household_id, user_id) values ('1b000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')$$, '23505', null, 'second active membership for a user rejected');
select throws_ok($$insert into public.household_members (household_id, user_id, role) values ('1a000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'owner')$$, '23505', null, 'second owner rejected');
select throws_ok($$update public.household_members set status = 'leaving' where id = 'aa000000-0000-4000-8000-000000000002'$$, '23514', null, 'leaving without an effective date rejected');
select throws_ok($$update public.household_members set status = 'left' where id = 'aa000000-0000-4000-8000-000000000002'$$, '23514', null, 'left without left_at rejected');
select lives_ok($$update public.household_members set status = 'left', left_at = now() where id = 'aa000000-0000-4000-8000-000000000003'$$, 'a member can leave');
select lives_ok($$insert into public.household_members (household_id, user_id) values ('1b000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003')$$, 'a user who left can join another household');
select throws_ok($$update public.household_members set role = 'member' where id = 'aa000000-0000-4000-8000-000000000001'$$, '23514', 'validation:owner:required', 'a household cannot be left without an owner');
select throws_ok($$update public.household_members set household_id = '1b000000-0000-4000-8000-000000000001' where id = 'aa000000-0000-4000-8000-000000000002'$$, 'P0001', 'permission_denied', 'a member row cannot move households');

-- ===== settlements =====
select throws_ok($$insert into public.settlements (household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, recorded_by) values ('1a000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001',100,'INR',current_date,'a0000000-0000-4000-8000-000000000001')$$, '23514', null, 'settlement to self rejected');
select throws_ok($$insert into public.settlements (household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, recorded_by) values ('1a000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002',0,'INR',current_date,'a0000000-0000-4000-8000-000000000001')$$, '23514', null, 'settlement of 0 rejected');
select throws_ok($$insert into public.settlements (household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, recorded_by) values ('1a000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001',100,'INR',current_date,'a0000000-0000-4000-8000-000000000001')$$, '23503', null, 'settlement with a member of another household rejected');
select throws_ok($$insert into public.settlements (household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, recorded_by) values ('1a000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002',100,'EUR',current_date,'a0000000-0000-4000-8000-000000000001')$$, '23514', 'validation:currency_code:mismatch', 'settlement currency must match household');
select lives_ok($$insert into public.settlements (household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, recorded_by) values ('1a000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001',100,'INR',current_date,'a0000000-0000-4000-8000-000000000002')$$, 'valid settlement accepted');

-- ===== currency lock (D9) =====
select throws_ok($$update public.households set currency_code = 'USD' where id = '1a000000-0000-4000-8000-000000000001'$$, 'P0001', 'currency_locked', 'currency locked once expenses exist');
select lives_ok($$update public.households set currency_code = 'USD' where id = '1c000000-0000-4000-8000-000000000001'$$, 'currency can change while no money exists');
select is((select version from public.households where id = '1c000000-0000-4000-8000-000000000001'), 2, 'household version increments on update');

-- ===== chores =====
select throws_ok($$insert into public.chores (household_id, title, created_by, recurrence_frequency) values ('1a000000-0000-4000-8000-000000000001','t','a0000000-0000-4000-8000-000000000001','weekly')$$, '23514', null, 'recurrence without a due date rejected');
select throws_ok($$insert into public.chores (household_id, title, created_by, due_date, rotation_member_ids) values ('1a000000-0000-4000-8000-000000000001','t','a0000000-0000-4000-8000-000000000001',current_date,array['aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002']::uuid[])$$, '23514', null, 'rotation without recurrence rejected');
select throws_ok($$insert into public.chores (household_id, title, created_by, due_date, recurrence_frequency, rotation_member_ids) values ('1a000000-0000-4000-8000-000000000001','t','a0000000-0000-4000-8000-000000000001',current_date,'weekly',array['aa000000-0000-4000-8000-000000000001']::uuid[])$$, '23514', null, 'rotation with fewer than two members rejected');
select throws_ok($$insert into public.chores (household_id, title, created_by, assignee_member_id) values ('1a000000-0000-4000-8000-000000000001','t','a0000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001')$$, '23503', null, 'chore assignee from another household rejected');
select lives_ok($$insert into public.chores (household_id, title, created_by, due_date, recurrence_frequency, rotation_member_ids, assignee_member_id) values ('1a000000-0000-4000-8000-000000000001','t','a0000000-0000-4000-8000-000000000001',current_date,'weekly',array['aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002']::uuid[],'aa000000-0000-4000-8000-000000000001')$$, 'valid recurring rotating chore accepted');

-- ===== groceries =====
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id, status) values ('1a000000-0000-4000-8000-000000000001','milk','aa000000-0000-4000-8000-000000000001','purchased')$$, '23514', null, 'purchased item must record purchaser and time');
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id, purchased_at) values ('1a000000-0000-4000-8000-000000000001','milk','aa000000-0000-4000-8000-000000000001', now())$$, '23514', null, 'needed item must not carry purchase fields');
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id, quantity) values ('1a000000-0000-4000-8000-000000000001','milk','aa000000-0000-4000-8000-000000000001', 0)$$, '23514', null, 'quantity must be positive');

-- ===== profile trigger =====
select is((select display_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), 'a', 'profile is created from the email local part');
select is((select count(*)::int from public.notification_prefs where member_id = 'aa000000-0000-4000-8000-000000000001'), 1, 'a default notification_prefs row is created per member');

select * from finish();
rollback;
