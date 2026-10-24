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
end $$;
create function public.test_logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
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

-- Parity with src/domain/domain.test.ts "balances": members a=ua, b=ub, c=uc.
--   Rent 90000 paid by a, split 30000 x3      Wifi 10000 paid by b, split a 5000 / b 5000
--   => a +55000, b -25000, c -30000
insert into public.t_ctx values
  ('s_rent', format('[{"member_id":"%s","share_amount_minor":30000},{"member_id":"%s","share_amount_minor":30000},{"member_id":"%s","share_amount_minor":30000}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc'))),
  ('s_wifi', format('[{"member_id":"%s","share_amount_minor":5000},{"member_id":"%s","share_amount_minor":5000}]', public.t('m_ua'), public.t('m_ub')));
select public.test_login(public.t('ua'));
select public.add_expense(public.t('h'), 'Rent', 90000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s_rent')::jsonb);
select public.test_login(public.t('ub'));
insert into public.t_ctx select 'wifi', public.add_expense(public.t('h'), 'Wifi', 10000, 'internet', public.t('m_ub'), current_date, 'equal', public.tt('s_wifi')::jsonb)::text;

select public.test_login(public.t('uc'));
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ua')), 55000::bigint, 'a is owed 550.00');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ub')), -25000::bigint, 'b owes 250.00');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_uc')), -30000::bigint, 'c owes 300.00');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ud')), 0::bigint, 'a member with no activity has zero');
select is((select count(*)::int from public.household_balances(public.t('h'))), 4, 'every member is listed');
select is((select sum(net_minor)::int from public.household_balances(public.t('h'))), 0, 'nets sum to zero');

-- deleted expenses are excluded
select public.test_login(public.t('ub'));
select public.delete_expense(public.t('wifi'));
select is((select array_agg(net_minor order by member_id) from public.household_balances(public.t('h')) where member_id in (public.t('m_ua'), public.t('m_ub'), public.t('m_uc'))),
  (select array_agg(v order by k) from (values (public.t('m_ua'), 60000::bigint), (public.t('m_ub'), -30000::bigint), (public.t('m_uc'), -30000::bigint)) x(k, v)),
  'deleted expense is excluded (a +60000, b -30000, c -30000)');
select public.restore_expense(public.t('wifi'));
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ua')), 55000::bigint, 'restored expense counts again');

-- settlements: recorded counts, disputed and reversed do not
--   s1 c->a 10000 recorded, s2 c->a 5000 disputed, s3 c->a 7000 reversed  =>  c -20000, a 45000, b -25000
select public.test_login(public.t('uc'));
select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 10000, current_date);
insert into public.t_ctx select 's2', public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 5000, current_date)::text;
insert into public.t_ctx select 's3', public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 7000, current_date)::text;
select public.set_settlement_status(public.t('s3'), 'reversed');
select public.test_login(public.t('ua'));
select public.set_settlement_status(public.t('s2'), 'disputed', 'not received');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_uc')), -20000::bigint, 'c: only the recorded settlement counts');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ua')), 45000::bigint, 'a: only the recorded settlement counts');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ub')), -25000::bigint, 'b is unaffected');
select is((select sum(net_minor)::int from public.household_balances(public.t('h'))), 0, 'still sums to zero with settlements');

-- access control
select public.test_login(public.t('ue'));
select throws_ok($$select * from public.household_balances(public.t('h'))$$, 'P0001', 'not_found', 'a non-member cannot read balances');
select public.test_login(public.t('uf'));
select throws_ok($$select * from public.household_balances(public.t('h'))$$, 'P0001', 'not_found', 'another household cannot read balances');
select public.test_logout();
select throws_ok($$select * from public.household_balances(public.t('h'))$$, 'P0001', 'permission_denied', 'unauthenticated cannot read balances');

select * from finish();
rollback;
