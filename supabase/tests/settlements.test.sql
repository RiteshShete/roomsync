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

-- ua paid 90000 split equally between ua, ub, uc  =>  ua +60000, ub -30000, uc -30000, ud 0
insert into public.t_ctx values
  ('s3_90k', format('[{"member_id":"%s","share_amount_minor":30000},{"member_id":"%s","share_amount_minor":30000},{"member_id":"%s","share_amount_minor":30000}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc')));
select public.test_login(public.t('ua'));
select public.add_expense(public.t('h'), 'Rent', 90000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s3_90k')::jsonb);

-- ===== record_settlement =====
select public.test_login(public.t('uc'));
select lives_ok($$insert into public.t_ctx select 's1', public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 30000, current_date, 'paid by UPI outside the app')::text$$, 'payer records a settlement');
select is((select status from public.settlements where id = public.t('s1')), 'recorded', 'settlement is "recorded", not "sent"');
select is((select currency_code from public.settlements where id = public.t('s1')), 'INR', 'currency comes from the household');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_uc')), 0::bigint, 'payer balance moves up by the amount');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ua')), 30000::bigint, 'recipient balance moves down by the amount');
select is((select count(*)::int from public.audit_events where entity_id = public.t('s1') and action = 'recorded'), 1, 'recording writes an audit row');
select is((select recipient_member_ids from public.activity_events where entity_id = public.t('s1') and event_type = 'settlement.recorded'), array[public.t('m_ua')], 'the other party is notified, not the actor');

select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_ua'), public.t('m_ub'), 100, current_date)$$, 'P0001', 'permission_denied', 'a member who is neither payer nor recipient cannot record');
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_uc'), 100, current_date)$$, '23514', 'validation:settlement:same_member', 'same payer and recipient rejected');
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 0, current_date)$$, '23514', 'validation:amount:out_of_range', 'zero amount rejected');
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 10000000001, current_date)$$, '23514', 'validation:amount:out_of_range', 'amount above the maximum rejected');
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 100, current_date + 1)$$, '23514', 'validation:settlement_date:future', 'future date rejected');
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_uf'), 100, current_date)$$, 'P0001', 'not_found', 'cannot record with someone from another household');
select public.test_login(public.t('ub'));
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_ub'), public.t('m_uf'), 100, current_date)$$, 'P0001', 'not_found', 'even a party-of-one cannot pair with another household''s member');
select lives_ok($$select public.record_settlement(public.t('h'), public.t('m_ud'), public.t('m_ua'), 1000, current_date)$$, 'admin may record any pair');
select public.test_login(public.t('ue'));
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 100, current_date)$$, 'P0001', 'not_found', 'non-member cannot record');

-- ===== dispute / reverse / resolve =====
select public.test_login(public.t('ua'));  -- the recipient, who did not record it
select throws_ok($$select public.set_settlement_status(public.t('s1'), 'disputed')$$, '23514', 'validation:reason:required', 'a dispute needs a reason');
select throws_ok($$select public.set_settlement_status(public.t('s1'), 'bogus', 'x')$$, '23514', 'validation:status:invalid', 'unknown status rejected');
select lives_ok($$select public.set_settlement_status(public.t('s1'), 'disputed', 'I did not receive this')$$, 'recipient disputes with a reason');
select is((select status from public.settlements where id = public.t('s1')), 'disputed', 'status is disputed');
select is((select status_reason from public.settlements where id = public.t('s1')), 'I did not receive this', 'reason is stored');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_uc')), -30000::bigint, 'disputed settlements do not count toward balances');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ua')), 59000::bigint, 'disputed settlements do not count (recipient; ud paid ua 1000 separately)');
select throws_ok($$select public.set_settlement_status(public.t('s1'), 'disputed', 'again')$$, 'P0001', 'conflict', 'cannot set the same status twice');
select throws_ok($$select public.set_settlement_status(public.t('s1'), 'recorded', null, 1)$$, 'P0001', 'conflict', 'stale version rejected');

select public.test_login(public.t('uc'));  -- recorder cannot approve their own disputed settlement back
select throws_ok($$select public.set_settlement_status(public.t('s1'), 'recorded')$$, 'P0001', 'permission_denied', 'recorder cannot resolve a dispute raised by the other party');
select public.test_login(public.t('ua'));
select lives_ok($$select public.set_settlement_status(public.t('s1'), 'recorded')$$, 'the disputer can withdraw the dispute');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_uc')), 0::bigint, 'withdrawn dispute counts again');
select lives_ok($$select public.set_settlement_status(public.t('s1'), 'disputed', 'second thoughts')$$, 'dispute again');
select public.test_login(public.t('ub'));
select lives_ok($$select public.set_settlement_status(public.t('s1'), 'recorded')$$, 'an admin can resolve a dispute');

-- own settlement cannot be disputed by its recorder; a bystander can do nothing
select public.test_login(public.t('uc'));
select lives_ok($$insert into public.t_ctx select 's2', public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 500, current_date)::text$$, 'second settlement recorded');
select throws_ok($$select public.set_settlement_status(public.t('s2'), 'disputed', 'mine')$$, 'P0001', 'permission_denied', 'recorder cannot dispute their own settlement');
select public.test_login(public.t('ud'));
select throws_ok($$select public.set_settlement_status(public.t('s2'), 'disputed', 'nosy')$$, 'P0001', 'permission_denied', 'bystander cannot dispute');
select throws_ok($$select public.set_settlement_status(public.t('s2'), 'reversed')$$, 'P0001', 'permission_denied', 'bystander cannot reverse');

select public.test_login(public.t('uc'));
select lives_ok($$select public.set_settlement_status(public.t('s2'), 'reversed', 'typo')$$, 'recorder reverses their settlement');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_uc')), 0::bigint, 'reversed settlement is excluded from balances');
select throws_ok($$select public.set_settlement_status(public.t('s2'), 'recorded')$$, 'P0001', 'conflict', 'reversed is final');
select is((select count(*)::int from public.audit_events where entity_id = public.t('s2') and action = 'status_reversed'), 1, 'status change writes an audit row');

select public.test_login(public.t('ua'));
select is((select sum(net_minor)::int from public.household_balances(public.t('h'))), 0, 'balances always sum to zero');

-- ===== archived =====
select public.test_logout();
update public.households set status = 'archived' where id = public.t('h');
select public.test_login(public.t('uc'));
select throws_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 100, current_date)$$, 'P0001', 'household_archived', 'archived household rejects settlements');
select throws_ok($$select public.set_settlement_status(public.t('s1'), 'reversed')$$, 'P0001', 'household_archived', 'archived household rejects status changes');

select * from finish();
rollback;
