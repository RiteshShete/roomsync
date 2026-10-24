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

-- PLAN §7 permission matrix: every cell, allowed and denied.  ua=owner ub=admin uc,ud=member ue=outsider
insert into public.t_ctx values
  ('s1000', format('[{"member_id":"%s","share_amount_minor":250},{"member_id":"%s","share_amount_minor":250},{"member_id":"%s","share_amount_minor":250},{"member_id":"%s","share_amount_minor":250}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc'), public.t('m_ud')));
insert into public.t_ctx select 'inv', id::text from public.invitations where household_id = public.t('h');

-- ===== Read household data =====
select public.test_login(public.t('ua')); select is((select count(*)::int from public.households), 1, 'READ owner');
select public.test_login(public.t('ub')); select is((select count(*)::int from public.households), 1, 'READ admin');
select public.test_login(public.t('uc')); select is((select count(*)::int from public.households), 1, 'READ member');
select public.test_login(public.t('ue')); select is((select count(*)::int from public.households), 0, 'READ outsider denied');
select public.test_login(public.t('uf')); select is((select name from public.households), 'House B', 'READ other household sees only its own');

-- ===== Edit household settings (not currency after money exists) =====
select public.test_login(public.t('ua'));
select lives_ok($$select public.update_household(public.t('h'), (select version from public.households where id = public.t('h')), 'A: renamed')$$, 'EDIT SETTINGS owner');
select public.test_login(public.t('ub'));
select lives_ok($$select public.update_household(public.t('h'), (select version from public.households where id = public.t('h')), null, 'USD')$$, 'EDIT SETTINGS admin (currency while no money exists)');
select lives_ok($$select public.update_household(public.t('h'), (select version from public.households where id = public.t('h')), null, 'INR')$$, 'EDIT SETTINGS admin changes currency back');
select throws_ok($$select public.update_household(public.t('h'), 1, 'stale')$$, 'P0001', 'conflict', 'EDIT SETTINGS stale version rejected');
select public.test_login(public.t('uc'));
select throws_ok($$select public.update_household(public.t('h'), (select version from public.households where id = public.t('h')), 'nope')$$, 'P0001', 'permission_denied', 'EDIT SETTINGS member denied');

-- ===== Add expense: everyone; edit / delete / restore: any for admins, own only for members =====
select public.test_login(public.t('ua')); select lives_ok($$select public.add_expense(public.t('h'), 'ua exp', 1000, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'ADD EXPENSE owner');
select public.test_login(public.t('ub')); select lives_ok($$select public.add_expense(public.t('h'), 'ub exp', 1000, 'x', public.t('m_ub'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'ADD EXPENSE admin');
select public.test_login(public.t('uc')); select lives_ok($$insert into public.t_ctx select 'ec', public.add_expense(public.t('h'), 'uc exp', 1000, 'x', public.t('m_uc'), current_date, 'equal', public.tt('s1000')::jsonb)::text$$, 'ADD EXPENSE member');
select public.test_login(public.t('ud')); select lives_ok($$select public.add_expense(public.t('h'), 'ud exp', 1000, 'x', public.t('m_ud'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'ADD EXPENSE member (2)');

select public.test_login(public.t('ub'));
select throws_ok($$select public.update_household(public.t('h'), (select version from public.households where id = public.t('h')), null, 'USD')$$, 'P0001', 'currency_locked', 'EDIT SETTINGS currency locked once money exists (admin)');
select public.test_login(public.t('ua'));
select throws_ok($$select public.update_household(public.t('h'), (select version from public.households where id = public.t('h')), null, 'USD')$$, 'P0001', 'currency_locked', 'EDIT SETTINGS currency locked once money exists (owner)');

select lives_ok($$select public.edit_expense(public.t('ec'), 1, 'by owner', 1000, 'x', public.t('m_uc'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'EDIT EXPENSE owner edits a member''s');
select public.test_login(public.t('ub'));
select lives_ok($$select public.delete_expense(public.t('ec'))$$, 'DELETE EXPENSE admin deletes a member''s');
select public.test_login(public.t('ud'));
select throws_ok($$select public.restore_expense(public.t('ec'))$$, 'P0001', 'permission_denied', 'RESTORE EXPENSE member denied for another member''s');
select public.test_login(public.t('ua'));
select lives_ok($$select public.restore_expense(public.t('ec'))$$, 'RESTORE EXPENSE owner');
select public.test_login(public.t('ud'));
select throws_ok($$select public.edit_expense(public.t('ec'), 4, 'x', 1000, 'x', public.t('m_uc'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'P0001', 'permission_denied', 'EDIT EXPENSE member denied for another member''s');
select throws_ok($$select public.delete_expense(public.t('ec'))$$, 'P0001', 'permission_denied', 'DELETE EXPENSE member denied for another member''s');
select public.test_login(public.t('uc'));
select lives_ok($$select public.edit_expense(public.t('ec'), 4, 'own edit', 1000, 'x', public.t('m_uc'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'EDIT EXPENSE member edits own');
select lives_ok($$select public.delete_expense(public.t('ec'))$$, 'DELETE EXPENSE member deletes own');
select lives_ok($$select public.restore_expense(public.t('ec'))$$, 'RESTORE EXPENSE member restores own');

-- ===== Settlements: record / reverse / dispute =====
select public.test_login(public.t('ua'));
select lives_ok($$insert into public.t_ctx select 'sB', public.record_settlement(public.t('h'), public.t('m_ub'), public.t('m_uc'), 200, current_date)::text$$, 'RECORD owner records a pair they are not in');
select public.test_login(public.t('ub'));
select lives_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ud'), 50, current_date)$$, 'RECORD admin records any pair');
select public.test_login(public.t('uc'));
select lives_ok($$insert into public.t_ctx select 'sA', public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ud'), 100, current_date)::text$$, 'RECORD member records as payer');
select lives_ok($$insert into public.t_ctx select 'sC', public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ud'), 100, current_date)::text$$, 'RECORD member records again');
select lives_ok($$select public.record_settlement(public.t('h'), public.t('m_ud'), public.t('m_uc'), 10, current_date)$$, 'RECORD member records as recipient');
select public.test_login(public.t('ud'));
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_ua'), public.t('m_ub'), 10, current_date)$$, 'P0001', 'permission_denied', 'RECORD member denied when not a party');

select throws_ok($$select public.set_settlement_status(public.t('sB'), 'disputed', 'not mine')$$, 'P0001', 'permission_denied', 'DISPUTE member denied when not a party');
select throws_ok($$select public.set_settlement_status(public.t('sA'), 'reversed')$$, 'P0001', 'permission_denied', 'REVERSE member denied when they did not record it');
select lives_ok($$select public.set_settlement_status(public.t('sA'), 'disputed', 'never received')$$, 'DISPUTE member disputes as the other party');
select public.test_login(public.t('uc'));
select throws_ok($$select public.set_settlement_status(public.t('sC'), 'disputed', 'my own')$$, 'P0001', 'permission_denied', 'DISPUTE recorder denied');
select lives_ok($$select public.set_settlement_status(public.t('sC'), 'reversed', 'oops')$$, 'REVERSE member reverses what they recorded');
select public.test_login(public.t('ub'));
select lives_ok($$select public.set_settlement_status(public.t('sB'), 'reversed')$$, 'REVERSE admin reverses any');
select public.test_login(public.t('ua'));
select lives_ok($$select public.set_settlement_status(public.t('sA'), 'recorded')$$, 'owner resolves a dispute');
select lives_ok($$select public.set_settlement_status(public.t('sA'), 'disputed', 'owner disputes')$$, 'DISPUTE owner disputes any');

-- ===== Chores (direct writes governed by RLS) =====
select public.test_login(public.t('ua')); select lives_ok($$insert into public.chores (household_id, title, created_by) values (public.t('h'), 'ua chore', public.t('ua'))$$, 'CREATE CHORE owner');
select public.test_login(public.t('ub')); select lives_ok($$insert into public.chores (household_id, title, created_by) values (public.t('h'), 'ub chore', public.t('ub'))$$, 'CREATE CHORE admin');
select public.test_login(public.t('uc'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'uc made', public.t('uc'), public.t('m_ud')) returning id) insert into public.t_ctx select 'ch_uc', id::text from c$$, 'CREATE CHORE member (assigned to ud)');
select public.test_login(public.t('ud'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'ud made', public.t('ud'), public.t('m_ua')) returning id) insert into public.t_ctx select 'ch_ud', id::text from c$$, 'CREATE CHORE member (assigned to ua)');

select is(public.test_rows_affected(format('update public.chores set title = ''t1'' where id = %L', public.tt('ch_uc'))), 1, 'EDIT CHORE assignee edits');
select is(public.test_rows_affected(format('update public.chores set title = ''t2'' where id = %L', public.tt('ch_ud'))), 1, 'EDIT CHORE creator edits');
select public.test_login(public.t('uc'));
select is(public.test_rows_affected(format('update public.chores set title = ''t3'' where id = %L', public.tt('ch_ud'))), 0, 'EDIT CHORE other member denied');
select is(public.test_rows_affected(format('update public.chores set title = ''t4'' where id = %L', public.tt('ch_uc'))), 1, 'EDIT CHORE creator edits own');
select public.test_login(public.t('ub'));
select is(public.test_rows_affected(format('update public.chores set title = ''t5'' where id = %L', public.tt('ch_ud'))), 1, 'EDIT CHORE admin edits any');

-- cancel: admin any, creator only (an assignee who is not the creator may not)
select public.test_login(public.t('ud'));
select throws_ok(format('update public.chores set status = ''cancelled'' where id = %L', public.tt('ch_uc')), '42501', null, 'CANCEL CHORE assignee who is not the creator denied');
select public.test_login(public.t('ue'));
select is(public.test_rows_affected(format('update public.chores set status = ''cancelled'' where id = %L', public.tt('ch_uc'))), 0, 'CANCEL CHORE outsider denied');
select public.test_login(public.t('uc'));
select is(public.test_rows_affected(format('update public.chores set status = ''cancelled'' where id = %L', public.tt('ch_uc'))), 1, 'CANCEL CHORE creator cancels');
select public.test_login(public.t('ub'));
select is(public.test_rows_affected(format('update public.chores set status = ''cancelled'' where id = %L', public.tt('ch_ud'))), 1, 'CANCEL CHORE admin cancels any');

-- complete / reopen: assignee or creator (any member if unassigned), admins any
select public.test_login(public.t('ua'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'for uc', public.t('ua'), public.t('m_uc')) returning id) insert into public.t_ctx select 'ch_c1', id::text from c$$, 'chore assigned to uc, created by ua');
select public.test_login(public.t('ud'));
select throws_ok($$select public.complete_chore(public.t('ch_c1'))$$, 'P0001', 'permission_denied', 'COMPLETE member who is neither assignee nor creator denied');
select public.test_login(public.t('uc'));
select lives_ok($$select public.complete_chore(public.t('ch_c1'))$$, 'COMPLETE assignee completes');
select public.test_login(public.t('ud'));
select throws_ok($$select public.reopen_chore(public.t('ch_c1'))$$, 'P0001', 'permission_denied', 'REOPEN bystander denied');
select public.test_login(public.t('uc'));
select lives_ok($$select public.reopen_chore(public.t('ch_c1'))$$, 'REOPEN assignee reopens');
select public.test_login(public.t('ua'));
select lives_ok($$select public.complete_chore(public.t('ch_c1'))$$, 'COMPLETE creator/owner completes');
select public.test_login(public.t('ub'));
select lives_ok($$select public.reopen_chore(public.t('ch_c1'))$$, 'REOPEN admin reopens');

-- ===== Grocery: every member =====
select public.test_login(public.t('ud'));
select lives_ok($$with g as (insert into public.grocery_items (household_id, name, added_by_member_id) values (public.t('h'), 'Milk', public.t('m_ud')) returning id) insert into public.t_ctx select 'g1', id::text from g$$, 'GROCERY member adds');
select public.test_login(public.t('uc'));
select is(public.test_rows_affected(format('update public.grocery_items set name = ''Oat milk'' where id = %L', public.tt('g1'))), 1, 'GROCERY member edits');
select is(public.test_rows_affected(format('update public.grocery_items set status = ''purchased'', purchased_by_member_id = %L, purchased_at = now() where id = %L', public.tt('m_uc'), public.tt('g1'))), 1, 'GROCERY member marks purchased');
select public.test_login(public.t('ub'));
select is(public.test_rows_affected(format('update public.grocery_items set deleted_at = now() where id = %L', public.tt('g1'))), 1, 'GROCERY admin deletes (soft)');
select public.test_login(public.t('ue'));
select throws_ok($$insert into public.grocery_items (household_id, name, added_by_member_id) values (public.t('h'), 'x', public.t('m_ud'))$$, '42501', null, 'GROCERY outsider denied');

-- ===== Announcements: post all; edit/delete own or admin any; pin admins only =====
select public.test_login(public.t('ud'));
select lives_ok($$with a as (insert into public.announcements (household_id, title, body, created_by) values (public.t('h'), 'ud post', 'hello', public.t('ud')) returning id) insert into public.t_ctx select 'an1', id::text from a$$, 'POST member posts');
select throws_ok($$update public.announcements set pinned_at = now() where id = public.t('an1')$$, 'P0001', 'permission_denied', 'PIN member cannot pin even their own');
select is(public.test_rows_affected(format('update public.announcements set title = ''ud edit'' where id = %L', public.tt('an1'))), 1, 'EDIT ANNOUNCEMENT member edits own');
select public.test_login(public.t('uc'));
select is(public.test_rows_affected(format('update public.announcements set title = ''hack'' where id = %L', public.tt('an1'))), 0, 'EDIT ANNOUNCEMENT member denied on others''');
select public.test_login(public.t('ub'));
select lives_ok($$update public.announcements set pinned_at = now() where id = public.t('an1')$$, 'PIN admin pins');
select is(public.test_rows_affected(format('update public.announcements set title = ''admin edit'' where id = %L', public.tt('an1'))), 1, 'EDIT ANNOUNCEMENT admin edits any');
select public.test_login(public.t('ua'));
select is(public.test_rows_affected(format('update public.announcements set deleted_at = now() where id = %L', public.tt('an1'))), 1, 'DELETE ANNOUNCEMENT owner deletes any (soft)');
select lives_ok($$insert into public.announcements (household_id, title, body, created_by, pinned_at) values (public.t('h'), 'pinned', 'x', public.t('ua'), now())$$, 'POST owner may post pinned');

-- ===== Start move-out cells (details in moveout.test.sql) =====
select public.test_login(public.t('ud'));
select throws_ok($$select public.start_move_out(public.t('m_uc'), current_date + 5)$$, 'P0001', 'permission_denied', 'MOVE-OUT member denied for others');
select lives_ok($$select public.start_move_out(public.t('m_ud'), current_date + 5)$$, 'MOVE-OUT member for self');
select public.test_login(public.t('ub'));
select lives_ok($$select public.start_move_out(public.t('m_uc'), current_date + 5)$$, 'MOVE-OUT admin for a member');
select throws_ok($$select public.start_move_out(public.t('m_ua'), current_date + 5)$$, 'P0001', 'permission_denied', 'MOVE-OUT admin denied for the owner');
select public.test_login(public.t('ua'));
select lives_ok($$select public.start_move_out(public.t('m_ub'), current_date + 5)$$, 'MOVE-OUT owner for an admin');
select public.cancel_move_out(public.t('m_ub')); select public.cancel_move_out(public.t('m_uc')); select public.cancel_move_out(public.t('m_ud'));

-- ===== Activity read state, export, health =====
select public.test_login(public.t('uc'));
select lives_ok($$select public.add_expense(public.t('h'), 'for the feed', 1000, 'x', public.t('m_uc'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'an expense that notifies ua');
select public.test_login(public.t('ua'));
select cmp_ok(public.mark_all_activity_read(public.t('h')), '>=', 1, 'mark_all marks the events addressed to the caller');
select is(public.mark_all_activity_read(public.t('h')), 0, 'marking again changes nothing');
select is((select count(*)::int from public.activity_reads where member_id = public.t('m_ub')), 0, 'and does not touch anyone else''s read state');
select lives_ok($$select public.mark_activity_read((select id from public.activity_events where event_type = 'expense.added' limit 1))$$, 'mark_activity_read is idempotent');
select public.test_login(public.t('ue'));
select throws_ok($$select public.mark_activity_read((select id from public.activity_events limit 1))$$, 'P0001', 'not_found', 'an outsider cannot mark events (and cannot see them)');
select public.test_login(public.t('uc'));
select is((public.export_my_household_data(public.t('h')) ->> 'schema_version')::int, 1, 'export returns a versioned document');
select ok(jsonb_array_length(public.export_my_household_data(public.t('h')) -> 'expenses') >= 5, 'export includes the household''s expenses');
select ok(public.export_my_household_data(public.t('h'))::text !~ 'example\.test', 'export contains no email addresses');
select ok(not (public.export_my_household_data(public.t('h')) ? 'invitations'), 'export contains no invitation data');
select public.test_login(public.t('ue'));
select throws_ok($$select public.export_my_household_data(public.t('h'))$$, 'P0001', 'not_found', 'an outsider cannot export');
select public.test_logout();
select set_config('role', 'anon', true);
select is(public.health(), 'ok', 'health() is callable by anon');
select throws_ok($$select public.add_expense(public.t('h'), 'x', 1, 'x', public.t('m_ua'), current_date, 'equal', '[]'::jsonb)$$, '42501', null, 'anon cannot call any other RPC');
select public.test_logout();

-- ===== Ownership transfer, archive/restore =====
select public.test_login(public.t('ub'));
select throws_ok($$select public.set_household_archived(public.t('h'), true)$$, 'P0001', 'permission_denied', 'ARCHIVE admin denied');
select throws_ok($$select public.transfer_ownership(public.t('m_uc'))$$, 'P0001', 'permission_denied', 'TRANSFER admin denied');
select throws_ok($$select public.set_member_role(public.t('m_uc'), 'admin')$$, 'P0001', 'permission_denied', 'ROLE admin denied');
select public.test_login(public.t('uc'));
select throws_ok($$select public.set_household_archived(public.t('h'), true)$$, 'P0001', 'permission_denied', 'ARCHIVE member denied');
select throws_ok($$select public.transfer_ownership(public.t('m_uc'))$$, 'P0001', 'permission_denied', 'TRANSFER member denied');
select throws_ok($$select public.set_member_role(public.t('m_ud'), 'admin')$$, 'P0001', 'permission_denied', 'ROLE member denied');
select public.test_login(public.t('ua'));
select lives_ok($$select public.set_member_role(public.t('m_ud'), 'admin')$$, 'ROLE owner promotes');
select is((select role from public.household_members where id = public.t('m_ud')), 'admin', 'role changed');
select lives_ok($$select public.set_member_role(public.t('m_ud'), 'member')$$, 'ROLE owner demotes');
select throws_ok($$select public.set_member_role(public.t('m_ud'), 'owner')$$, '23514', 'validation:role:invalid', 'ROLE owner cannot hand out ownership this way');
select throws_ok($$select public.set_member_role(public.t('m_ua'), 'member')$$, '23514', 'validation:role:use_transfer', 'ROLE the owner cannot demote themselves this way');
select throws_ok($$select public.transfer_ownership(public.t('m_ua'))$$, '23514', 'validation:member:self', 'TRANSFER to self rejected');
select lives_ok($$select public.transfer_ownership(public.t('m_ub'))$$, 'TRANSFER owner hands over to ub');
select is((select array_agg(role order by role) from public.household_members where id in (public.t('m_ua'), public.t('m_ub'))), array['admin', 'owner'], 'old owner is admin, new owner is owner');
select is((select count(*)::int from public.household_members where household_id = public.t('h') and role = 'owner'), 1, 'exactly one owner');
select throws_ok($$select public.set_household_archived(public.t('h'), true)$$, 'P0001', 'permission_denied', 'ARCHIVE the former owner is now denied');

select public.test_login(public.t('ub'));
select lives_ok($$select public.set_household_archived(public.t('h'), true)$$, 'ARCHIVE new owner archives');
select is((select status from public.households where id = public.t('h')), 'archived', 'household archived');

-- every write RPC is refused while archived
select throws_ok($$select public.update_household(public.t('h'), 99, 'x')$$, 'P0001', 'household_archived', 'ARCHIVED update_household');
select throws_ok($$select public.create_invite(public.t('h'))$$, 'P0001', 'household_archived', 'ARCHIVED create_invite');
select throws_ok($$select public.revoke_invite(public.t('inv'))$$, 'P0001', 'household_archived', 'ARCHIVED revoke_invite');
select throws_ok($$select public.add_expense(public.t('h'), 'x', 1000, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'P0001', 'household_archived', 'ARCHIVED add_expense');
select throws_ok($$select public.edit_expense(public.t('ec'), 1, 'x', 1000, 'x', public.t('m_uc'), current_date, 'equal', public.tt('s1000')::jsonb)$$, 'P0001', 'household_archived', 'ARCHIVED edit_expense');
select throws_ok($$select public.delete_expense(public.t('ec'))$$, 'P0001', 'household_archived', 'ARCHIVED delete_expense');
select throws_ok($$select public.restore_expense(public.t('ec'))$$, 'P0001', 'household_archived', 'ARCHIVED restore_expense');
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ud'), 1, current_date)$$, 'P0001', 'household_archived', 'ARCHIVED record_settlement');
select throws_ok($$select public.set_settlement_status(public.t('sA'), 'reversed')$$, 'P0001', 'household_archived', 'ARCHIVED set_settlement_status');
select throws_ok($$select public.complete_chore(public.t('ch_c1'))$$, 'P0001', 'household_archived', 'ARCHIVED complete_chore');
select throws_ok($$select public.set_member_role(public.t('m_uc'), 'admin')$$, 'P0001', 'household_archived', 'ARCHIVED set_member_role');
select throws_ok($$select public.transfer_ownership(public.t('m_ua'))$$, 'P0001', 'household_archived', 'ARCHIVED transfer_ownership');
select throws_ok($$select public.start_move_out(public.t('m_uc'), current_date + 5)$$, 'P0001', 'household_archived', 'ARCHIVED start_move_out');
select lives_ok($$select public.mark_all_activity_read(public.t('h'))$$, 'ARCHIVED reading state still works');
select lives_ok($$select * from public.household_balances(public.t('h'))$$, 'ARCHIVED balances still readable');
select lives_ok($$select public.export_my_household_data(public.t('h'))$$, 'ARCHIVED export still works');
select lives_ok($$select public.set_household_archived(public.t('h'), false)$$, 'RESTORE owner restores while archived');
select is((select status from public.households where id = public.t('h')), 'active', 'household active again');
select is(public.set_household_archived(public.t('h'), false), (select version from public.households where id = public.t('h')), 'restoring an active household is a no-op');

select * from finish();
rollback;
