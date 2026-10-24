-- Structural security guards. A future table or function that forgets RLS/privileges fails here.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0, 'every table in public has RLS enabled');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')),
  17, 'public has the 17 expected tables (update this count when adding a table)');

-- anon must have no privilege of any kind on any public table.
select ok(not has_any_column_privilege('anon', c.oid, 'select, insert, update, references'),
  'anon has no privileges on public.' || c.relname || ' ')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname;

-- authenticated can never DELETE (deletes are soft) or TRUNCATE.
select ok(not has_table_privilege('authenticated', c.oid, 'delete')
          and not has_table_privilege('authenticated', c.oid, 'truncate'),
  'authenticated cannot delete from or truncate public.' || c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname;

-- Direct INSERT is allowed only on these tables; everything else is RPC-only.
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_any_column_privilege('authenticated', c.oid, 'insert')),
  array['announcements', 'chores', 'grocery_items'],
  'direct INSERT is limited to announcements, chores, grocery_items');

-- Direct UPDATE is allowed only on these tables.
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_any_column_privilege('authenticated', c.oid, 'update')),
  array['announcements', 'chores', 'grocery_items', 'notification_prefs', 'profiles'],
  'direct UPDATE is limited to announcements, chores, grocery_items, notification_prefs, profiles');

-- Sensitive / server-owned columns are not writable by members.
select ok(not has_column_privilege('authenticated', 'public.chores', 'completed_at', 'update')
      and not has_column_privilege('authenticated', 'public.chores', 'completed_by', 'update')
      and not has_column_privilege('authenticated', 'public.chores', 'spawned_next_id', 'update')
      and not has_column_privilege('authenticated', 'public.chores', 'household_id', 'update')
      and not has_column_privilege('authenticated', 'public.chores', 'created_by', 'update'),
  'chore completion/ownership columns are not directly updatable');
select ok(not has_column_privilege('authenticated', 'public.invitations', 'code_hash', 'select'),
  'invitation code_hash is not readable');

-- No function in public or private is executable by anon or PUBLIC (our own functions only).
select ok(not has_function_privilege('anon', p.oid, 'execute'),
  'anon cannot execute ' || n.nspname || '.' || p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private') order by n.nspname, p.proname;

-- Every security definer function in our schemas pins search_path to empty.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not coalesce(p.proconfig, '{}') @> array['search_path=""']),
  0, 'every security definer function sets search_path to empty');

select * from finish();
rollback;
