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

-- Header state: 'code' was used by ub, uc, ud to join House A (24h, no max uses).
insert into public.t_ctx values
  ('ug', 'a0000000-0000-4000-8000-000000000007'), ('uh', 'a0000000-0000-4000-8000-000000000008');
insert into auth.users (id, email) select v::uuid, k || '@example.test' from public.t_ctx where k in ('ug', 'uh');

insert into public.t_ctx select 'inv_main', id::text from public.invitations where household_id = public.t('h');

-- ===== what is stored =====
select is((select count(*)::int from public.invitations where code_hash = public.tt('code')), 0, 'the plaintext code is never stored');
select is((select length(code_hash) from public.invitations where household_id = public.t('h')), 64, 'only a SHA-256 hex hash is stored');
select is((select code_hint from public.invitations where household_id = public.t('h')), right(public.tt('code'), 2), 'a two-character hint is kept for the pending list');
select ok(public.tt('code') ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$', 'code is 8 chars from the unambiguous alphabet');
select is((select use_count from public.invitations where household_id = public.t('h')), 3, 'use_count counts the three joins');
select is((select count(*)::int from public.audit_events where household_id = public.t('h') and action = 'joined'), 3, 'joins are audited');
select is((select count(*)::int from public.activity_events where household_id = public.t('h') and event_type = 'member.joined'), 3, 'joins create activity');

-- ===== create / revoke permissions =====
select public.test_login(public.t('uc'));
select throws_ok($$select public.create_invite(public.t('h'))$$, 'P0001', 'permission_denied', 'a plain member cannot create invites');
select public.test_login(public.t('ue'));
select throws_ok($$select public.create_invite(public.t('h'))$$, 'P0001', 'not_found', 'a non-member cannot create invites');
select public.test_login(public.t('ub'));
select lives_ok($$insert into public.t_ctx select 'code2', public.create_invite(public.t('h'), 1, 1) ->> 'code'$$, 'an admin can create a one-use invite');
select throws_ok($$select public.create_invite(public.t('h'), 0)$$, '23514', 'validation:expires_in_hours:out_of_range', 'expiry below 1 hour rejected');
select throws_ok($$select public.create_invite(public.t('h'), 721)$$, '23514', 'validation:expires_in_hours:out_of_range', 'expiry above 30 days rejected');
select throws_ok($$select public.create_invite(public.t('h'), 24, 0)$$, '23514', 'validation:max_uses:out_of_range', 'max_uses 0 rejected');
select public.test_login(public.t('uc'));
select throws_ok($$select public.revoke_invite((select id from public.invitations limit 1))$$, 'P0001', 'not_found', 'a plain member cannot even see invites to revoke them');

-- ===== preview =====
select public.test_login(public.t('ue'));
select is((public.preview_invite(public.tt('code')) ->> 'household_name'), 'House A', 'preview shows the household name');
select is((public.preview_invite(public.tt('code')) ->> 'member_count')::int, 4, 'preview shows the member count');
select is((select array_agg(k order by k) from jsonb_object_keys(public.preview_invite(public.tt('code'))) k),
  array['expires_at', 'household_name', 'member_count', 'ok'], 'preview exposes no member identities');
select is((public.preview_invite(lower(substr(public.tt('code'), 1, 4) || '-' || substr(public.tt('code'), 5))) ->> 'ok')::boolean, true, 'codes are normalised (case, dashes)');
select is(public.preview_invite('ABCD2345') ->> 'error', 'invalid_invite:not_found', 'unknown code');
select is(public.preview_invite('bad') ->> 'error', 'invalid_invite:not_found', 'malformed code is reported as not found');
select is(public.preview_invite(null) ->> 'error', 'invalid_invite:not_found', 'null code is reported as not found');
select public.test_logout();
select is((select count(*)::int from public.invite_attempts where user_id = public.t('ue') and not succeeded), 3, 'failed attempts are recorded (not rolled back)');

-- ===== throttle: 10 failures per hour =====
select public.test_login(public.t('ue'));
select lives_ok($$select count(public.preview_invite('ZZZZ2222')) from generate_series(1, 7)$$, 'seven more bad guesses');
select is(public.preview_invite(public.tt('code')) ->> 'error', 'invalid_invite:throttled', 'the 11th attempt is throttled even with a valid code');
select is(public.join_household(public.tt('code')) ->> 'error', 'invalid_invite:throttled', 'joining is throttled too');
select public.test_logout();
update public.invite_attempts set attempted_at = now() - interval '2 hours' where user_id = public.t('ue');
select public.test_login(public.t('ue'));
select is(public.preview_invite(public.tt('code')) ->> 'ok', 'true', 'attempts older than an hour no longer count');

-- ===== join =====
select is((public.join_household(public.tt('code')) ->> 'ok')::boolean, true, 'ue joins with a valid code');
select is((select count(*)::int from public.household_members where user_id = public.t('ue') and status = 'active'), 1, 'membership created');
select throws_ok($$select public.join_household(public.tt('code'))$$, 'P0001', 'already_member', 'a member cannot join again');
select throws_ok($$select public.preview_invite(public.tt('code'))$$, 'P0001', 'already_member', 'a member cannot preview either');
select throws_ok($$select public.create_household('Second')$$, 'P0001', 'already_member', 'one active household per user');

-- ===== invalid states =====
select public.test_login(public.t('ug'));
select is(public.join_household(public.tt('code2')) ->> 'ok', 'true', 'one-use code works once');
select public.test_login(public.t('uh'));
select is(public.preview_invite(public.tt('code2')) ->> 'error', 'invalid_invite:used_up', 'one-use code is used up');
select is(public.join_household(public.tt('code2')) ->> 'error', 'invalid_invite:used_up', 'cannot join with a used-up code');

select public.test_login(public.t('ua'));
select public.revoke_invite(public.t('inv_main'));
select lives_ok($$select public.revoke_invite((select id from public.invitations where household_id = public.t('h') and status = 'revoked' limit 1))$$, 'revoking twice is harmless');
select public.test_login(public.t('uh'));
select is(public.preview_invite(public.tt('code')) ->> 'error', 'invalid_invite:revoked', 'revoked code');
select is(public.join_household(public.tt('code')) ->> 'error', 'invalid_invite:revoked', 'cannot join with a revoked code');

select public.test_login(public.t('ua'));
insert into public.t_ctx select 'code3', public.create_invite(public.t('h'), 1, null) ->> 'code';
select public.test_logout();
update public.invitations set expires_at = now() - interval '1 minute' where code_hash = encode(extensions.digest(public.tt('code3'), 'sha256'), 'hex');
select public.test_login(public.t('uh'));
select is(public.preview_invite(public.tt('code3')) ->> 'error', 'invalid_invite:expired', 'expired code');

select public.test_login(public.t('ua'));
insert into public.t_ctx select 'code4', public.create_invite(public.t('h'), 24, null) ->> 'code';
select public.test_logout();
update public.households set status = 'archived' where id = public.t('h');
select public.test_login(public.t('uh'));
select is(public.preview_invite(public.tt('code4')) ->> 'error', 'invalid_invite:household_archived', 'archived household');
select public.test_logout();
update public.households set status = 'active' where id = public.t('h');

-- household full: 12 non-left members
insert into auth.users (id, email) select ('c0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'f' || i || '@example.test' from generate_series(1, 6) i;
insert into public.household_members (household_id, user_id)
  select public.t('h'), ('c0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 6) i;
select is((select count(*)::int from public.household_members where household_id = public.t('h') and status <> 'left'), 12, 'household has 12 members');
select public.test_login(public.t('uh'));
select is(public.preview_invite(public.tt('code4')) ->> 'error', 'invalid_invite:household_full', 'full household');
select is(public.join_household(public.tt('code4')) ->> 'error', 'invalid_invite:household_full', 'cannot join a full household');
select is((select count(*)::int from public.household_members where user_id = public.t('uh')), 0, 'a failed join leaves no membership');

select * from finish();
rollback;
