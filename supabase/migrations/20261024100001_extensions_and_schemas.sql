-- Extensions, the private schema, and locked-down default privileges.

create extension if not exists pgcrypto with schema extensions;

-- Helper functions used by RLS policies live here. This schema is NOT exposed through the API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Objects created by migrations must not be reachable by the Data API roles unless granted
-- explicitly (see the grants migration). service_role keeps its defaults.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
