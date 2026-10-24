-- Function privileges. Postgres grants EXECUTE to PUBLIC by default, so every function created by a
-- migration is reachable until revoked. Here: nothing for PUBLIC/anon; RPCs for `authenticated`;
-- only `health` for anon. Any future migration that adds a function must end with the same
-- revoke/grant (rls_enabled.test.sql fails if anon can execute anything but health).

revoke all on all functions in schema public from public, anon;
revoke all on all functions in schema private from public, anon;

grant execute on all functions in schema public to authenticated;
-- private helpers stay unreachable from the API except those RLS policies call
revoke execute on all functions in schema private from authenticated;
grant execute on function
  private.is_member(uuid), private.is_active_member(uuid), private.is_admin(uuid),
  private.my_member_id(uuid), private.is_my_member(uuid), private.is_member_of_member(uuid),
  private.household_is_active(uuid), private.is_assignable_member(uuid, uuid),
  private.all_members_in_household(uuid[], uuid), private.shares_household_with(uuid)
to authenticated;

grant execute on function public.health() to anon;
