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

-- rotation order: ua -> ub -> uc
select public.test_login(public.t('ua'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency, rotation_member_ids)
    values (public.t('h'), 'Dishes', public.t('ua'), public.t('m_ua'), current_date + 1, 'weekly', array[public.t('m_ua'), public.t('m_ub'), public.t('m_uc')]) returning id)
  insert into public.t_ctx select 'c1', id::text from c$$, 'create a recurring chore with rotation');

-- ===== complete: records history and spawns the next occurrence =====
select lives_ok($$insert into public.t_ctx select 'r1', public.complete_chore(public.t('c1'))::text$$, 'assignee completes');
select is((select status from public.chores where id = public.t('c1')), 'completed', 'chore is completed');
select isnt((select completed_at from public.chores where id = public.t('c1')), null, 'completed_at is set');
select is((select completed_by from public.chores where id = public.t('c1')), public.t('ua'), 'completed_by is the actor');
select is((public.tt('r1')::jsonb ->> 'next_chore_id')::uuid, (select spawned_next_id from public.chores where id = public.t('c1')), 'result points at the spawned chore');
select is((select assignee_member_id from public.chores where id = (public.tt('r1')::jsonb ->> 'next_chore_id')::uuid), public.t('m_ub'), 'rotation moves to the next member');
select is((select due_date from public.chores where id = (public.tt('r1')::jsonb ->> 'next_chore_id')::uuid), current_date + 8, 'next due date is one week later');
select is((select status from public.chores where id = (public.tt('r1')::jsonb ->> 'next_chore_id')::uuid), 'open', 'successor is open');
select is((select rotation_member_ids from public.chores where id = (public.tt('r1')::jsonb ->> 'next_chore_id')::uuid), array[public.t('m_ua'), public.t('m_ub'), public.t('m_uc')], 'rotation list carries over');
select is((select count(*)::int from public.chore_completions where chore_id = public.t('c1') and completed_by_member_id = public.t('m_ua')), 1, 'completion history row written');
select is((select recipient_member_ids from public.activity_events where event_type = 'chore.assigned' and entity_id = (public.tt('r1')::jsonb ->> 'next_chore_id')::uuid), array[public.t('m_ub')], 'the next assignee is notified');
select is((select count(*)::int from public.activity_events where event_type = 'chore.completed' and entity_id = public.t('c1')), 1, 'completion creates activity');

select throws_ok($$select public.complete_chore(public.t('c1'))$$, 'P0001', 'conflict', 'cannot complete twice');

-- ===== rotation skips members who are not active, and says so =====
select public.test_logout();
update public.household_members set status = 'leaving', move_out_effective_date = current_date + 10 where id = public.t('m_uc');
select public.test_login(public.t('ub'));
select lives_ok($$insert into public.t_ctx select 'r2', public.complete_chore((public.tt('r1')::jsonb ->> 'next_chore_id')::uuid)::text$$, 'ub completes the successor');
select is((public.tt('r2')::jsonb ->> 'next_assignee_member_id')::uuid, public.t('m_ua'), 'rotation skips the leaving member (uc) and wraps to ua');
select is(public.tt('r2')::jsonb -> 'skipped_member_ids', to_jsonb(array[public.t('m_uc')]), 'skipped members are reported');
select public.test_logout();
update public.household_members set status = 'active', move_out_effective_date = null where id = public.t('m_uc');

-- ===== never in the past; non-rotating recurring chores keep their assignee =====
select public.test_login(public.t('ua'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency)
    values (public.t('h'), 'Old', public.t('ua'), public.t('m_ua'), current_date - 30, 'weekly') returning id)
  insert into public.t_ctx select 'c_old', id::text from c$$, 'an overdue recurring chore');
select lives_ok($$insert into public.t_ctx select 'r_old', public.complete_chore(public.t('c_old'))::text$$, 'complete the overdue chore');
select is((select due_date from public.chores where id = (public.tt('r_old')::jsonb ->> 'next_chore_id')::uuid), current_date + 5, 'next occurrence is never in the past');
select is((select assignee_member_id from public.chores where id = (public.tt('r_old')::jsonb ->> 'next_chore_id')::uuid), public.t('m_ua'), 'assignee is kept when there is no rotation');

-- one-off chore: no successor
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'One-off', public.t('ua'), public.t('m_ua')) returning id)
  insert into public.t_ctx select 'c_one', id::text from c$$, 'a one-off chore');
select is(public.complete_chore(public.t('c_one')) -> 'next_chore_id', 'null'::jsonb, 'a one-off chore spawns nothing');

-- ===== who may complete =====
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'Mine', public.t('ua'), public.t('m_ua')) returning id)
  insert into public.t_ctx select 'c_mine', id::text from c$$, 'chore assigned to ua');
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by) values (public.t('h'), 'Anyone', public.t('ua')) returning id)
  insert into public.t_ctx select 'c_free', id::text from c$$, 'unassigned chore');
select public.test_login(public.t('ud'));
select throws_ok($$select public.complete_chore(public.t('c_mine'))$$, 'P0001', 'permission_denied', 'a bystander cannot complete an assigned chore');
select lives_ok($$select public.complete_chore(public.t('c_free'))$$, 'any member can complete an unassigned chore');
select public.test_login(public.t('ub'));
select lives_ok($$select public.complete_chore(public.t('c_mine'))$$, 'an admin can complete anyone''s chore');
select throws_ok($$select public.complete_chore(public.t('c_mine'), 99)$$, 'P0001', 'conflict', 'a completed chore cannot be completed again');
select public.test_login(public.t('ue'));
select throws_ok($$select public.complete_chore(public.t('c_mine'))$$, 'P0001', 'not_found', 'a non-member cannot complete');

-- ===== reopen =====
select public.test_login(public.t('ua'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency)
    values (public.t('h'), 'Trash', public.t('ua'), public.t('m_ua'), current_date + 1, 'weekly') returning id)
  insert into public.t_ctx select 'c2', id::text from c$$, 'recurring chore without rotation');
select throws_ok($$select public.reopen_chore(public.t('c2'))$$, 'P0001', 'conflict', 'cannot reopen a chore that is not completed');
select lives_ok($$insert into public.t_ctx select 'r3', public.complete_chore(public.t('c2'))::text$$, 'complete it');
select public.test_login(public.t('ud'));
select throws_ok($$select public.reopen_chore(public.t('c2'))$$, 'P0001', 'permission_denied', 'a bystander cannot reopen');
select public.test_login(public.t('ua'));
select lives_ok($$insert into public.t_ctx select 'ro1', public.reopen_chore(public.t('c2'))::text$$, 'reopen while the successor is still open');
select is((select status from public.chores where id = public.t('c2')), 'open', 'chore is open again');
select is((select completed_at from public.chores where id = public.t('c2')), null, 'completion fields cleared');
select is((select spawned_next_id from public.chores where id = public.t('c2')), null, 'link to successor cleared');
select is((select status from public.chores where id = (public.tt('r3')::jsonb ->> 'next_chore_id')::uuid), 'cancelled', 'the open successor is cancelled so there are no duplicates');
select is(public.tt('ro1')::jsonb ->> 'cancelled_successor_id', public.tt('r3')::jsonb ->> 'next_chore_id', 'reopen reports the cancelled successor');
select isnt((select reopened_at from public.chore_completions where chore_id = public.t('c2')), null, 'history row is marked reopened, not deleted');
select is((select count(*)::int from public.chores where title = 'Trash' and status = 'open'), 1, 'exactly one open occurrence remains');

-- complete again, then complete the successor => the earlier one can no longer be reopened
select lives_ok($$insert into public.t_ctx select 'r4', public.complete_chore(public.t('c2'))::text$$, 'complete again');
select lives_ok($$select public.complete_chore((public.tt('r4')::jsonb ->> 'next_chore_id')::uuid)$$, 'complete the successor');
select throws_ok($$select public.reopen_chore(public.t('c2'))$$, 'P0001', 'later_occurrence_completed', 'cannot reopen once a later occurrence was completed');
select is((select status from public.chores where id = public.t('c2')), 'completed', 'refused reopen changed nothing');

-- ===== nobody left to rotate to =====
select public.test_logout();
update public.household_members set status = 'leaving', move_out_effective_date = current_date + 10 where id in (public.t('m_ub'), public.t('m_uc'));
select public.test_login(public.t('ua'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency, rotation_member_ids)
    values (public.t('h'), 'Lonely', public.t('ua'), public.t('m_ub'), current_date + 1, 'weekly', array[public.t('m_ub'), public.t('m_uc')]) returning id)
  insert into public.t_ctx select 'c_lonely', id::text from c$$, 'rotation of two leaving members');
select lives_ok($$insert into public.t_ctx select 'r5', public.complete_chore(public.t('c_lonely'))::text$$, 'owner completes it');
select is(public.tt('r5')::jsonb -> 'next_assignee_member_id', 'null'::jsonb, 'no active member to assign');
select is((select assignee_member_id from public.chores where id = (public.tt('r5')::jsonb ->> 'next_chore_id')::uuid), null, 'successor is left unassigned');
select is((select count(*)::int from public.activity_events where event_type = 'chore.needs_assignee' and entity_id = (public.tt('r5')::jsonb ->> 'next_chore_id')::uuid), 1, 'admins are told it needs an assignee');

-- ===== archived =====
select public.test_logout();
update public.households set status = 'archived' where id = public.t('h');
select public.test_login(public.t('ua'));
select throws_ok($$select public.complete_chore(public.t('c_free'))$$, 'P0001', 'household_archived', 'archived household rejects completion');
select throws_ok($$select public.reopen_chore(public.t('c_free'))$$, 'P0001', 'household_archived', 'archived household rejects reopen');

select * from finish();
rollback;
