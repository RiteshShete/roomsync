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

insert into public.t_ctx values
  ('s4', format('[{"member_id":"%s","share_amount_minor":750},{"member_id":"%s","share_amount_minor":750},{"member_id":"%s","share_amount_minor":750},{"member_id":"%s","share_amount_minor":750}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc'), public.t('m_ud'))),
  ('s2x', format('[{"member_id":"%s","share_amount_minor":500},{"member_id":"%s","share_amount_minor":500}]', public.t('m_ua'), public.t('m_ud')));

-- shared history that must survive the move-out: ua paid 3000, split 4 ways (ud owes 750)
select public.test_login(public.t('ua'));
select public.add_expense(public.t('h'), 'Groceries', 3000, 'food', public.t('m_ua'), current_date, 'equal', public.tt('s4')::jsonb);
-- chores that involve ud
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency, rotation_member_ids)
    values (public.t('h'), 'A rotating', public.t('ua'), public.t('m_ud'), current_date + 3, 'weekly', array[public.t('m_ua'), public.t('m_ud'), public.t('m_uc')]) returning id)
  insert into public.t_ctx select 'cA', id::text from c$$, 'chore A: ud assigned, rotation ua/ud/uc');
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'B plain', public.t('ua'), public.t('m_ud')) returning id)
  insert into public.t_ctx select 'cB', id::text from c$$, 'chore B: ud assigned, no rotation');
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency, rotation_member_ids)
    values (public.t('h'), 'C other', public.t('ua'), public.t('m_ub'), current_date + 2, 'weekly', array[public.t('m_ud'), public.t('m_ub')]) returning id)
  insert into public.t_ctx select 'cC', id::text from c$$, 'chore C: ub assigned, rotation ud/ub');

-- ===== validation =====
select public.test_login(public.t('ud'));
select throws_ok($$select public.start_move_out(public.t('m_ud'), current_date - 1)$$, '23514', 'validation:effective_date:out_of_range', 'a past date is rejected');
select throws_ok($$select public.start_move_out(public.t('m_ud'), current_date + 91)$$, '23514', 'validation:effective_date:out_of_range', 'more than 90 days ahead is rejected');
select throws_ok($$select public.start_move_out(public.t('m_ud'), null)$$, '23514', 'validation:effective_date:out_of_range', 'a missing date is rejected');
select is((select status from public.household_members where id = public.t('m_ud')), 'active', 'rejected requests changed nothing');

-- ===== start (future date) =====
select lives_ok($$select public.start_move_out(public.t('m_ud'), current_date + 10, 'moving to Pune', 12345)$$, 'a member starts their own move-out');
select is((select status from public.household_members where id = public.t('m_ud')), 'leaving', 'status is leaving');
select is((select move_out_effective_date from public.household_members where id = public.t('m_ud')), current_date + 10, 'effective date stored');
select is((select move_out_requested_by from public.household_members where id = public.t('m_ud')), public.t('m_ud'), 'requested_by is the member');
select is((select move_out_note from public.household_members where id = public.t('m_ud')), 'moving to Pune', 'note stored');
select is((select move_out_acknowledged_balance_minor from public.household_members where id = public.t('m_ud')), 12345::bigint, 'the balance the member saw is recorded');
select is((select count(*)::int from public.audit_events where entity_id = public.t('m_ud') and action = 'move_out_started'), 1, 'start is audited');
select is((select cardinality(recipient_member_ids) from public.activity_events where entity_id = public.t('m_ud') and event_type = 'member.move_out_started'), 3, 'everyone else is told');
select is((select count(*)::int from public.households), 1, 'a leaving member still has access until the date');
select is((select count(*)::int from public.expenses), 1, 'and still sees the history');
select throws_ok($$select public.start_move_out(public.t('m_ud'), current_date + 10)$$, '23514', 'validation:status:not_active', 'cannot start twice');

-- ===== who may start =====
select public.test_login(public.t('uc'));
select throws_ok($$select public.start_move_out(public.t('m_ub'), current_date + 5)$$, 'P0001', 'permission_denied', 'a member cannot start move-out for someone else');
select public.test_login(public.t('ub'));
select throws_ok($$select public.start_move_out(public.t('m_ua'), current_date + 5)$$, 'P0001', 'permission_denied', 'an admin cannot start move-out for the owner');
select public.test_login(public.t('ua'));
select throws_ok($$select public.start_move_out(public.t('m_ua'), current_date + 5)$$, 'P0001', 'owner_must_transfer', 'the owner must transfer ownership first');
select public.test_login(public.t('uf'));
select throws_ok($$select public.start_move_out(public.t('m_uf'), current_date + 5)$$, 'P0001', 'sole_member', 'a sole member is directed to archive instead');

-- ===== dispute notes =====
select public.test_login(public.t('ud'));
select lives_ok($$select public.add_move_out_dispute(public.t('m_ud'), 'I think the Wi-Fi share is wrong')$$, 'the leaving member adds a note/dispute');
select public.test_login(public.t('uc'));
select throws_ok($$select public.add_move_out_dispute(public.t('m_ud'), 'meddling')$$, 'P0001', 'permission_denied', 'someone else cannot add a dispute for them');
select is((select count(*)::int from public.member_move_out_disputes), 1, 'housemates can read the dispute');
select public.test_login(public.t('ue'));
select is((select count(*)::int from public.member_move_out_disputes), 0, 'outsiders cannot');
select public.test_login(public.t('uc'));
select throws_ok($$select public.add_move_out_dispute(public.t('m_uc'), 'x')$$, 'P0001', 'conflict', 'only a leaving member can add a dispute');
select is((select status from public.household_members where id = public.t('m_ud')), 'leaving', 'a dispute never resolves anything');

-- ===== cancel =====
select throws_ok($$select public.cancel_move_out(public.t('m_ud'))$$, 'P0001', 'permission_denied', 'a member cannot cancel someone else''s move-out');
select public.test_login(public.t('ud'));
select lives_ok($$select public.cancel_move_out(public.t('m_ud'))$$, 'the member cancels while still leaving');
select is((select status from public.household_members where id = public.t('m_ud')), 'active', 'active again');
select is((select move_out_effective_date from public.household_members where id = public.t('m_ud')), null, 'move-out fields cleared');
select throws_ok($$select public.cancel_move_out(public.t('m_ud'))$$, 'P0001', 'conflict', 'cannot cancel when not leaving');
select public.test_login(public.t('ub'));
select lives_ok($$select public.start_move_out(public.t('m_ud'), current_date + 10)$$, 'an admin can start move-out for a member');
select is((select move_out_requested_by from public.household_members where id = public.t('m_ud')), public.t('m_ub'), 'requested_by records the admin');

-- ===== effective date passes: reconcile =====
select public.test_logout();
update public.household_members set move_out_effective_date = current_date - 1 where id = public.t('m_ud');
select public.test_login(public.t('ua'));
select is(public.reconcile_household(public.t('h')), 1, 'one member flipped to left');
select is((select status from public.household_members where id = public.t('m_ud')), 'left', 'ud has left');
select isnt((select left_at from public.household_members where id = public.t('m_ud')), null, 'left_at is set');
select is(public.reconcile_household(public.t('h')), 0, 'reconciling again is a no-op');
select is((select assignee_member_id from public.chores where id = public.t('cA')), public.t('m_uc'), 'rotating chore moves to the next member in rotation');
select is((select rotation_member_ids from public.chores where id = public.t('cA')), array[public.t('m_ua'), public.t('m_uc')], 'ud is removed from the rotation');
select is((select assignee_member_id from public.chores where id = public.t('cB')), null, 'a non-rotating chore becomes unassigned');
select is((select assignee_member_id from public.chores where id = public.t('cC')), public.t('m_ub'), 'chores of other members are untouched');
select is((select rotation_member_ids from public.chores where id = public.t('cC')), null, 'a rotation left with fewer than two members becomes null');
select is((select count(*)::int from public.activity_events where event_type = 'member.left' and entity_id = public.t('m_ud')), 1, 'member.left is emitted once');
select is((select count(*)::int from public.activity_events where event_type = 'chore.needs_assignee' and entity_id = public.t('cB')), 1, 'admins are told chore B needs an assignee');
select is((select recipient_member_ids from public.activity_events where event_type = 'chore.reassigned' and entity_id = public.t('cA')), array[public.t('m_uc')], 'the new assignee is told');

-- history is preserved and unresolved balances stay visible
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ud')), -750::bigint, 'the departed member''s balance stays visible, unresolved');
select is((select count(*)::int from public.expense_shares where member_id = public.t('m_ud')), 1, 'their shares remain in the history');
select throws_ok($$select public.add_expense(public.t('h'), 'New', 1000, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s2x')::jsonb)$$, '23514', 'validation:participants:not_assignable', 'a left member cannot be added to a new expense');
select throws_ok($$insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'x', public.t('ua'), public.t('m_ud'))$$, '42501', null, 'a left member cannot be assigned a new chore');
select lives_ok($$select public.record_settlement(public.t('h'), public.t('m_ud'), public.t('m_ua'), 750, current_date)$$, 'their balance can still be settled explicitly');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ud')), 0::bigint, 'only an explicit settlement changed it');

-- the departed user: no access, and free to start over
select public.test_login(public.t('ud'));
select is((select count(*)::int from public.households), 0, 'ud no longer sees the household');
select is((select count(*)::int from public.expenses), 0, 'nor its expenses');
select throws_ok($$select public.add_expense(public.t('h'), 'x', 1000, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s2x')::jsonb)$$, 'P0001', 'not_found', 'nor can they write to it');
select is(public.reconcile_household(public.t('h')), 0, 'ud may still ask whether they have left');
select lives_ok($$select public.create_household('Ud House')$$, 'a user who left can create another household');
select is((select count(*)::int from public.my_left_households() where household_id = public.t('h') and name = 'House A' and left_at is not null), 1, 'my_left_households tells ud which household they left');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'my_left_households' and pg_get_function_result(p.oid) = 'TABLE(household_id uuid, name text, left_at timestamp with time zone)'), 1, 'it returns exactly household_id, name and left_at');
select public.test_login(public.t('ue'));
select is((select count(*)::int from public.my_left_households()), 0, 'someone who never left anything sees none');
select public.test_login(public.t('ua'));
select is((select count(*)::int from public.my_left_households()), 0, 'a current member (owner) sees none');
select public.test_login(public.t('ue'));
select throws_ok($$select public.reconcile_household(public.t('h'))$$, 'P0001', 'not_found', 'someone who never belonged cannot');
select public.test_logout();
set role anon;
select throws_ok($$select * from public.my_left_households()$$, '42501', null, 'anon cannot call my_left_households');
reset role;

-- ===== effective today flips immediately; rotation prune cascades =====
select public.test_login(public.t('uc'));
select lives_ok($$select public.start_move_out(public.t('m_uc'), current_date)$$, 'move-out effective today');
select public.test_login(public.t('ua'));
select is((select status from public.household_members where id = public.t('m_uc')), 'left', 'flipped to left straight away');
select is((select assignee_member_id from public.chores where id = public.t('cA')), public.t('m_ua'), 'chore A passes to the only remaining active rotation member');
select is((select rotation_member_ids from public.chores where id = public.t('cA')), null, 'rotation of one becomes null');
select public.test_login(public.t('uc'));
select throws_ok($$select public.complete_chore(public.t('cA'))$$, 'P0001', 'not_found', 'uc can no longer act');

-- ===== reconcile runs at the start of every RPC (lazy, PLAN D10) =====
select public.test_login(public.t('ub'));
select lives_ok($$select public.start_move_out(public.t('m_ub'), current_date + 5)$$, 'admin ub starts their own move-out');
select public.test_logout();
update public.household_members set move_out_effective_date = current_date - 1 where id = public.t('m_ub');
select public.test_login(public.t('ua'));
select lives_ok($$select * from public.household_balances(public.t('h'))$$, 'any ordinary RPC call...');
select is((select status from public.household_members where id = public.t('m_ub')), 'left', '...reconciled the household first');
select is((select assignee_member_id from public.chores where id = public.t('cC')), null, 'chore C lost its assignee');
select is((select count(*)::int from public.activity_events where event_type = 'chore.needs_assignee' and entity_id = public.t('cC')), 1, 'and admins were told');

-- ===== ua is now the only member =====
select throws_ok($$select public.start_move_out(public.t('m_ua'), current_date + 5)$$, 'P0001', 'sole_member', 'the last member can only archive');
select is((select count(*)::int from public.household_members where household_id = public.t('h') and status <> 'left'), 1, 'one member remains');
select is((select count(*)::int from public.household_members where household_id = public.t('h') and role = 'owner' and status <> 'left'), 1, 'and still exactly one owner');

select * from finish();
rollback;
