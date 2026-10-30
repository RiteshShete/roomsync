-- The Supabase security advisor flags trigger functions without a pinned search_path. These five are
-- security invoker and already schema-qualify every name they use, so an empty search_path changes nothing.
alter function private.bump_version() set search_path = '';
alter function private.set_updated_at() set search_path = '';
alter function private.forbid_household_change() set search_path = '';
alter function private.guard_grocery_purchaser() set search_path = '';
alter function private.guard_announcement_pin() set search_path = '';
