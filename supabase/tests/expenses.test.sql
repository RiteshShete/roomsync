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

-- share payloads (client-computed, PLAN D4)
insert into public.t_ctx values
  ('s3',     format('[{"member_id":"%s","share_amount_minor":33334},{"member_id":"%s","share_amount_minor":33333},{"member_id":"%s","share_amount_minor":33333}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc'))),
  ('s3_90k', format('[{"member_id":"%s","share_amount_minor":30000},{"member_id":"%s","share_amount_minor":30000},{"member_id":"%s","share_amount_minor":30000}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc'))),
  ('s_bad',  format('[{"member_id":"%s","share_amount_minor":500},{"member_id":"%s","share_amount_minor":400}]', public.t('m_ua'), public.t('m_ub'))),
  ('s_out',  format('[{"member_id":"%s","share_amount_minor":500},{"member_id":"%s","share_amount_minor":500}]', public.t('m_ua'), public.t('m_uf'))),
  ('s_dup',  format('[{"member_id":"%s","share_amount_minor":500},{"member_id":"%s","share_amount_minor":500}]', public.t('m_ua'), public.t('m_ua'))),
  ('s_pct',  format('[{"member_id":"%s","share_amount_minor":50000,"percent_bp":5000},{"member_id":"%s","share_amount_minor":30000,"percent_bp":3000},{"member_id":"%s","share_amount_minor":20000,"percent_bp":2000}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc'))),
  ('s_pct_bad', format('[{"member_id":"%s","share_amount_minor":50000,"percent_bp":5000},{"member_id":"%s","share_amount_minor":50000,"percent_bp":4000}]', public.t('m_ua'), public.t('m_ub'))),
  ('s_nopct', format('[{"member_id":"%s","share_amount_minor":50000},{"member_id":"%s","share_amount_minor":50000}]', public.t('m_ua'), public.t('m_ub'))),
  ('s_uc3k', format('[{"member_id":"%s","share_amount_minor":1000},{"member_id":"%s","share_amount_minor":1000},{"member_id":"%s","share_amount_minor":1000}]', public.t('m_ua'), public.t('m_ub'), public.t('m_uc')));

-- ===== add_expense =====
select public.test_login(public.t('ua'));
select lives_ok($$insert into public.t_ctx select 'e1', public.add_expense(public.t('h'), 'Rent', 100000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s3')::jsonb)::text$$,
  'add a ₹1,000 equal expense split across three');
select is((select array_agg(share_amount_minor order by share_amount_minor desc) from public.expense_shares where expense_id = public.t('e1')),
  array[33334::bigint, 33333, 33333], 'shares are 333.34 / 333.33 / 333.33');
select is((select currency_code from public.expenses where id = public.t('e1')), 'INR', 'currency comes from the household');
select is((select count(*)::int from public.audit_events where entity_id = public.t('e1') and action = 'created'), 1, 'creation writes an audit row');
select is((select cardinality(recipient_member_ids) from public.activity_events where entity_id = public.t('e1') and event_type = 'expense.added'), 2,
  'activity goes to the two other affected members, not the actor');
select is((select metadata ->> 'title' from public.activity_events where entity_id = public.t('e1') and event_type = 'expense.added'), 'Rent', 'activity metadata carries the title');
select lives_ok($$select public.add_expense(public.t('h'), 'Pct', 100000, 'misc', public.t('m_ua'), current_date, 'percentage', public.tt('s_pct')::jsonb)$$, 'percentage split accepted');

select throws_ok($$select public.add_expense(public.t('h'), '  ', 100, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s3')::jsonb)$$, '23514', 'validation:title:required', 'blank title rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 0, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s3')::jsonb)$$, '23514', 'validation:amount:out_of_range', 'amount 0 rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 10000000001, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s3')::jsonb)$$, '23514', 'validation:amount:out_of_range', 'amount above the maximum rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'equal', '[]'::jsonb)$$, '23514', 'validation:shares:required', 'no participants rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'custom', public.tt('s_bad')::jsonb)$$, '23514', 'validation:shares:sum_mismatch', 'shares that do not sum to the total rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'custom', public.tt('s_dup')::jsonb)$$, '23514', 'validation:shares:duplicate_member', 'duplicate participant rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'custom', public.tt('s_out')::jsonb)$$, '23514', 'validation:participants:not_assignable', 'participant from another household rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_uf'), current_date, 'custom', public.tt('s_bad')::jsonb)$$, '23514', 'validation:participants:not_assignable', 'payer from another household rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 100000, 'x', public.t('m_ua'), current_date, 'percentage', public.tt('s_pct_bad')::jsonb)$$, '23514', 'validation:shares:percent_total', 'percentages not totalling 100% rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 100000, 'x', public.t('m_ua'), current_date, 'percentage', public.tt('s_nopct')::jsonb)$$, '23514', 'validation:shares:percent_bp', 'percentage split without percentages rejected');
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'barter', public.tt('s3')::jsonb)$$, '23514', 'validation:split_method:invalid', 'unknown split method rejected');
select is((select count(*)::int from public.expenses), 2, 'failed adds left no partial expense behind');

select public.test_login(public.t('ue'));
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s3')::jsonb)$$, 'P0001', 'not_found', 'a non-member cannot add to the household (indistinguishable from missing)');
select public.test_logout();
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s3')::jsonb)$$, 'P0001', 'permission_denied', 'unauthenticated call rejected');

-- ===== edit_expense =====
select public.test_login(public.t('ub'));  -- admin may edit anyone's expense
select lives_ok($$insert into public.t_ctx select 'edit1', public.edit_expense(public.t('e1'), 1, 'Rent (fixed)', 90000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s3_90k')::jsonb)::text$$, 'admin can edit');
select is((tt('edit1')::jsonb ->> 'version')::int, 2, 'edit returns the new version');
select is((tt('edit1')::jsonb ->> 'settlements_exist')::boolean, false, 'no settlements yet');
select is(jsonb_array_length(tt('edit1')::jsonb -> 'impact'), 3, 'impact lists every member whose balance moved');
select is((select (jsonb_path_query_first(tt('edit1')::jsonb -> 'impact', '$[*] ? (@.member_id == $m)', jsonb_build_object('m', public.tt('m_ua')))) ->> 'after_minor'), '110000', 'impact shows payer balance after the edit (includes other expenses)');
select is((select sum(share_amount_minor)::int from public.expense_shares where expense_id = public.t('e1')), 90000, 'shares were replaced and sum to the new amount');
select is((select (before ->> 'amount_minor') || '>' || (after ->> 'amount_minor') from public.audit_events where entity_id = public.t('e1') and action = 'edited'), '100000>90000', 'edit audit keeps before and after');
select throws_ok($$select public.edit_expense(public.t('e1'), 1, 'x', 90000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s3_90k')::jsonb)$$, 'P0001', 'conflict', 'stale version rejected');
select throws_ok($$select public.edit_expense(public.t('e1'), 2, 'x', 90000, 'rent', public.t('m_ua'), current_date, 'custom', public.tt('s_bad')::jsonb)$$, '23514', 'validation:shares:sum_mismatch', 'invalid edit rejected');
select is((select title from public.expenses where id = public.t('e1')), 'Rent (fixed)', 'a rejected edit changed nothing');

select public.test_login(public.t('uc'));  -- plain member: only own expenses
select throws_ok($$select public.edit_expense(public.t('e1'), 2, 'x', 90000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s3_90k')::jsonb)$$, 'P0001', 'permission_denied', 'member cannot edit someone else''s expense');
select throws_ok($$select public.delete_expense(public.t('e1'))$$, 'P0001', 'permission_denied', 'member cannot delete someone else''s expense');
select lives_ok($$insert into public.t_ctx select 'e2', public.add_expense(public.t('h'), 'Milk', 3000, 'food', public.t('m_uc'), current_date, 'equal', public.tt('s_uc3k')::jsonb)::text$$, 'member adds own expense');
select lives_ok($$select public.edit_expense(public.t('e2'), 1, 'Milk+', 3000, 'food', public.t('m_uc'), current_date, 'equal', public.tt('s_uc3k')::jsonb)$$, 'member can edit own expense');

-- settlement exists => flag is true on the next edit
select public.test_login(public.t('uc'));
select lives_ok($$select public.record_settlement(public.t('h'), public.t('m_uc'), public.t('m_ua'), 5000, current_date)$$, 'settlement recorded');
select public.test_login(public.t('ua'));
select lives_ok($$insert into public.t_ctx select 'edit2', public.edit_expense(public.t('e1'), 2, 'Rent (again)', 90000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s3_90k')::jsonb)::text$$, 'creator edits after a settlement exists');
select is((tt('edit2')::jsonb ->> 'settlements_exist')::boolean, true, 'edit reports that settlements exist');

-- ===== delete / restore =====
select lives_ok($$select public.delete_expense(public.t('e1'), 3)$$, 'creator soft-deletes');
select isnt((select deleted_at from public.expenses where id = public.t('e1')), null, 'row is kept with deleted_at');
select is((select count(*)::int from public.expense_shares where expense_id = public.t('e1')), 3, 'shares are kept for history');
select is((select count(*)::int from public.audit_events where entity_id = public.t('e1') and action = 'deleted'), 1, 'delete writes an audit row');
select throws_ok($$select public.delete_expense(public.t('e1'))$$, 'P0001', 'conflict', 'cannot delete twice');
select throws_ok($$select public.edit_expense(public.t('e1'), 4, 'x', 90000, 'rent', public.t('m_ua'), current_date, 'equal', public.tt('s3_90k')::jsonb)$$, 'P0001', 'conflict', 'cannot edit a deleted expense');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_ua')), 44000::bigint, 'deleted expense is excluded from balances (ua)');
select is((select net_minor from public.household_balances(public.t('h')) where member_id = public.t('m_uc')), -13000::bigint, 'deleted expense is excluded from balances (uc)');
select lives_ok($$select public.restore_expense(public.t('e1'))$$, 'creator restores');
select is((select deleted_at from public.expenses where id = public.t('e1')), null, 'restored row is active again');
select throws_ok($$select public.restore_expense(public.t('e1'))$$, 'P0001', 'conflict', 'cannot restore an active expense');

-- ===== archived household blocks writes =====
select public.test_logout();
update public.households set status = 'archived' where id = public.t('h');
select public.test_login(public.t('ua'));
select throws_ok($$select public.add_expense(public.t('h'), 'T', 1000, 'x', public.t('m_ua'), current_date, 'equal', public.tt('s3')::jsonb)$$, 'P0001', 'household_archived', 'archived household rejects new expenses');
select throws_ok($$select public.delete_expense(public.t('e2'))$$, 'P0001', 'household_archived', 'archived household rejects deletes');
select lives_ok($$select * from public.household_balances(public.t('h'))$$, 'archived household is still readable');

select * from finish();
rollback;
