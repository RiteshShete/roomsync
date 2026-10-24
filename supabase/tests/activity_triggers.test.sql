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

-- Activity events for direct writes to chores and grocery items (triggers), and silence inside RPCs.
-- Helper: sorted recipients of the one event of a type on an entity.
create function public.ev_rec(p_entity uuid, p_type text) returns uuid[] language sql stable as $$
  select array(select x from unnest(recipient_member_ids) x order by x) from public.activity_events where entity_id = p_entity and event_type = p_type $$;
create function public.ev_n(p_entity uuid, p_type text) returns int language sql stable as $$
  select count(*)::int from public.activity_events where entity_id = p_entity and event_type = p_type $$;
create function public.ev_types(p_entity uuid) returns text[] language sql stable as $$
  select coalesce(array_agg(event_type order by event_type), '{}') from public.activity_events where entity_id = p_entity $$;
create function public.sorted(a uuid[]) returns uuid[] language sql immutable as $$ select array(select x from unnest(a) x order by x) $$;
grant execute on function public.ev_rec(uuid, text), public.ev_n(uuid, text), public.ev_types(uuid), public.sorted(uuid[]) to authenticated;

-- ===== chores: created =====
select public.test_login(public.t('ua'));
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date) values (public.t('h'), 'Dishes', public.t('ua'), public.t('m_uc'), current_date + 1) returning id) insert into public.t_ctx select 'c1', id::text from c$$, 'create a chore assigned to uc');
select is(public.ev_n(public.t('c1'), 'chore.created'), 1, 'creating a chore emits one event');
select is(public.ev_rec(public.t('c1'), 'chore.created'), array[public.t('m_uc')], 'the assignee is notified, not the creator');
select is((select actor_member_id from public.activity_events where entity_id = public.t('c1') and event_type = 'chore.created'), public.t('m_ua'), 'the actor is the creator''s member');
select is((select array_agg(k order by k) from jsonb_object_keys((select metadata from public.activity_events where entity_id = public.t('c1') and event_type = 'chore.created')) k), array['due_date', 'title'], 'metadata holds only title and due date');

select lives_ok($$with c as (insert into public.chores (household_id, title, created_by) values (public.t('h'), 'Anyone', public.t('ua')) returning id) insert into public.t_ctx select 'c_free', id::text from c$$, 'create an unassigned chore');
select is(public.ev_rec(public.t('c_free'), 'chore.created'), '{}'::uuid[], 'nobody is notified about an unassigned chore');
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id) values (public.t('h'), 'Mine', public.t('ua'), public.t('m_ua')) returning id) insert into public.t_ctx select 'c_mine', id::text from c$$, 'create a chore assigned to yourself');
select is(public.ev_rec(public.t('c_mine'), 'chore.created'), '{}'::uuid[], 'assigning to yourself notifies nobody');

-- ===== chores: reassigned, edited, no-op, cancelled =====
select lives_ok($$update public.chores set assignee_member_id = public.t('m_ud') where id = public.t('c1')$$, 'reassign');
select is(public.ev_rec(public.t('c1'), 'chore.assigned'), array[public.t('m_ud')], 'reassignment notifies the new assignee');
select is((select actor_member_id from public.activity_events where entity_id = public.t('c1') and event_type = 'chore.assigned'), public.t('m_ua'), 'with the right actor');
select is(public.ev_n(public.t('c1'), 'chore.edited'), 0, 'a pure reassignment is not also an edit');

select lives_ok($$update public.chores set title = 'Dishes (fixed)' where id = public.t('c1')$$, 'edit the title');
select is(public.ev_rec(public.t('c1'), 'chore.edited'), array[public.t('m_ud')], 'an edit notifies the assignee');
select is((select metadata ->> 'title' from public.activity_events where entity_id = public.t('c1') and event_type = 'chore.edited'), 'Dishes (fixed)', 'with the new title');

select lives_ok($$update public.chores set title = title where id = public.t('c1')$$, 'a no-op update');
select is(public.ev_n(public.t('c1'), 'chore.edited'), 1, 'emits nothing new');

select lives_ok($$update public.chores set status = 'cancelled', cancel_reason = 'no longer needed' where id = public.t('c1')$$, 'cancel');
select is(public.ev_rec(public.t('c1'), 'chore.cancelled'), array[public.t('m_ud')], 'cancelling notifies the assignee');
select is((select metadata::text from public.activity_events where entity_id = public.t('c1') and event_type = 'chore.cancelled'), '{"title": "Dishes (fixed)"}', 'without leaking the cancel reason');

-- ===== RPC writes do not double-emit =====
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency, rotation_member_ids)
  values (public.t('h'), 'Rotating', public.t('ua'), public.t('m_ua'), current_date + 1, 'weekly', array[public.t('m_ua'), public.t('m_ub'), public.t('m_uc')]) returning id) insert into public.t_ctx select 'c2', id::text from c$$, 'create a rotating chore');
select lives_ok($$insert into public.t_ctx select 'r2', public.complete_chore(public.t('c2'))::text$$, 'complete it through the RPC');
select is(public.ev_types((public.tt('r2')::jsonb ->> 'next_chore_id')::uuid), array['chore.assigned'], 'the spawned chore has only the RPC''s assignment event (the trigger stayed silent)');
select is(public.ev_types(public.t('c2')), array['chore.completed', 'chore.created'], 'the completed chore has its creation and the RPC''s completion, nothing duplicated');
select lives_ok($$select public.reopen_chore(public.t('c2'))$$, 'reopen it');
select is(public.ev_types((public.tt('r2')::jsonb ->> 'next_chore_id')::uuid), array['chore.assigned'], 'cancelling the successor on reopen emitted no "cancelled" event');
select is(public.ev_n(public.t('c2'), 'chore.reopened'), 1, 'the reopen event comes from the RPC');

-- reconcile (member leaves today) reassigns through the RPC, which emits its own event only
select public.test_login(public.t('ua'));  -- a new request
select lives_ok($$with c as (insert into public.chores (household_id, title, created_by, assignee_member_id, due_date, recurrence_frequency, rotation_member_ids)
  values (public.t('h'), 'Leaver''s chore', public.t('ua'), public.t('m_ud'), current_date + 2, 'weekly', array[public.t('m_ua'), public.t('m_ud')]) returning id) insert into public.t_ctx select 'c3', id::text from c$$, 'a chore rotating between ua and ud');
select public.test_login(public.t('ud'));
select lives_ok($$select public.start_move_out(public.t('m_ud'), current_date)$$, 'ud leaves today');
select public.test_login(public.t('ua'));
select is(public.ev_types(public.t('c3')), array['chore.created', 'chore.reassigned'], 'reconcile emitted its own reassignment and the trigger added nothing');

-- ===== groceries =====
select public.test_login(public.t('ub'));
select lives_ok($$with g as (insert into public.grocery_items (household_id, name, added_by_member_id) values (public.t('h'), 'Milk', public.t('m_ub')) returning id) insert into public.t_ctx select 'g1', id::text from g$$, 'ub adds milk');
select is(public.ev_rec(public.t('g1'), 'grocery.added'), public.sorted(array[public.t('m_ua'), public.t('m_uc')]), 'every other current member is told (ud has left)');
select is((select metadata::text from public.activity_events where entity_id = public.t('g1') and event_type = 'grocery.added'), '{"name": "Milk"}', 'with the name only');
select is((select actor_member_id from public.activity_events where entity_id = public.t('g1') and event_type = 'grocery.added'), public.t('m_ub'), 'and the right actor');

select public.test_login(public.t('uc'));
select lives_ok($$update public.grocery_items set status = 'purchased', purchased_by_member_id = public.t('m_uc'), purchased_at = now() where id = public.t('g1')$$, 'uc buys it');
select is(public.ev_rec(public.t('g1'), 'grocery.purchased'), array[public.t('m_ub')], 'the person who added it is told');
select is((select actor_member_id from public.activity_events where entity_id = public.t('g1') and event_type = 'grocery.purchased'), public.t('m_uc'), 'purchaser is the actor');

select lives_ok($$update public.grocery_items set status = 'needed', purchased_by_member_id = null, purchased_at = null where id = public.t('g1')$$, 'moved back to needed');
select is(public.ev_rec(public.t('g1'), 'grocery.moved_back'), array[public.t('m_ub')], 'moving it back is announced');

select lives_ok($$update public.grocery_items set name = 'Oat milk', quantity = 2, unit = 'l', note = 'barista' where id = public.t('g1')$$, 'edit details');
select is(public.ev_types(public.t('g1')), array['grocery.added', 'grocery.moved_back', 'grocery.purchased'], 'edits are not noisy');

select lives_ok($$update public.grocery_items set deleted_at = now() where id = public.t('g1')$$, 'delete (soft)');
select is(public.ev_rec(public.t('g1'), 'grocery.deleted'), array[public.t('m_ub')], 'deletion is announced to the person who added it');
select lives_ok($$update public.grocery_items set deleted_at = null where id = public.t('g1')$$, 'undo the delete');
select is(public.ev_rec(public.t('g1'), 'grocery.restored'), array[public.t('m_ub')], 'restore is announced');

-- ===== isolation =====
select public.test_login(public.t('uf'));
select is((select count(*)::int from public.activity_events where entity_id in (public.t('c1'), public.t('g1'))), 0, 'another household sees none of it');
select public.test_login(public.t('ue'));
select is((select count(*)::int from public.activity_events), 0, 'an outsider sees no events');

select * from finish();
rollback;
