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

-- ===== sending and reading =====
select public.test_login(public.t('ua'));
select lives_ok($$insert into public.chat_messages (household_id, sender_member_id, body) values (public.t('h'), public.t('m_ua'), 'hello house')$$, 'a member can send a message as themselves');
select public.test_login(public.t('ub'));
select is((select count(*)::int from public.chat_messages), 1, 'another member of the household reads it');
select lives_ok($$insert into public.chat_messages (household_id, sender_member_id, body) values (public.t('h'), public.t('m_ub'), 'hi')$$, 'a second member can reply');

-- ===== who may not =====
select throws_ok($$insert into public.chat_messages (household_id, sender_member_id, body) values (public.t('h'), public.t('m_ua'), 'pretending to be ua')$$, '42501', null, 'cannot send as another member');
select throws_ok($$insert into public.chat_messages (household_id, sender_member_id, body) values (public.t('h'), public.t('m_ub'), '   ')$$, '23514', null, 'blank messages are refused');
select throws_ok($$insert into public.chat_messages (household_id, sender_member_id, body) values (public.t('h'), public.t('m_ub'), repeat('x', 501))$$, '23514', null, 'messages over 500 characters are refused');
select throws_ok($$update public.chat_messages set body = 'edited'$$, '42501', null, 'messages cannot be edited');
select throws_ok($$delete from public.chat_messages$$, '42501', null, 'messages cannot be deleted by members');
select throws_ok($$insert into public.chat_messages (household_id, sender_member_id, body, created_at) values (public.t('h'), public.t('m_ub'), 'backdated', now() - interval '2 days')$$, '42501', null, 'the time cannot be set by the sender');

select public.test_login(public.t('uf'));
select is((select count(*)::int from public.chat_messages), 0, 'another household sees nothing');
select throws_ok($$insert into public.chat_messages (household_id, sender_member_id, body) values (public.t('h'), public.t('m_uf'), 'intruder')$$, '42501', null, 'cannot post into a household you are not in');
select public.test_login(public.t('ue'));
select is((select count(*)::int from public.chat_messages), 0, 'someone with no household sees nothing');
select public.test_logout();
select throws_ok($$set local role anon; select count(*) from public.chat_messages$$, '42501', null, 'anon cannot read');
reset role;

-- ===== left members lose access; archived households are read-only =====
update public.household_members set status = 'left', left_at = now() where id = public.t('m_ud');
select public.test_login(public.t('ud'));
select is((select count(*)::int from public.chat_messages), 0, 'a member who has left reads nothing');
select public.test_logout();
update public.households set status = 'archived' where id = public.t('h');
select public.test_login(public.t('ua'));
select throws_ok($$insert into public.chat_messages (household_id, sender_member_id, body) values (public.t('h'), public.t('m_ua'), 'too late')$$, '42501', null, 'an archived household takes no new messages');
select is((select count(*)::int from public.chat_messages), 2, 'but members can still read');
select public.test_logout();
update public.households set status = 'active' where id = public.t('h');

-- ===== storage stays bounded =====
insert into public.chat_messages (household_id, sender_member_id, body, created_at)
  select public.t('h'), public.t('m_ua'), 'old ' || i, now() - interval '8 days' - make_interval(mins => i) from generate_series(1, 5) i;
select private.prune_old_rows(public.t('h'));
select is((select count(*)::int from public.chat_messages where body like 'old %'), 0, 'messages older than 7 days are pruned');
select is((select count(*)::int from public.chat_messages), 2, 'recent messages survive pruning');
insert into public.chat_messages (household_id, sender_member_id, body, created_at)
  select public.t('h'), public.t('m_ua'), 'bulk ' || i, now() - make_interval(secs => i) from generate_series(1, 320) i;
select private.prune_old_rows(public.t('h'));
select is((select count(*)::int from public.chat_messages where household_id = public.t('h')), 300, 'only the newest 300 are kept');
select is((select count(*)::int from public.chat_messages where body = 'hello house'), 1, 'the newest messages are the ones kept');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages'), 1, 'chat is in the realtime publication');

select * from finish();
rollback;
