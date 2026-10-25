-- Phase 8: a person who has left a household loses access to its data (RLS only lets current members
-- read it), but the app should still say "You've left <household>". This returns exactly that and
-- nothing else: the household's name and when the caller left, for the caller's own memberships.

create function public.my_left_households()
returns table (household_id uuid, name text, left_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.require_uid();
begin
  return query
    select h.id, h.name, m.left_at
      from public.household_members m
      join public.households h on h.id = m.household_id
     where m.user_id = u and m.status = 'left' and m.left_at is not null
     order by m.left_at desc
     limit 10;
end;
$$;

revoke all on function public.my_left_households() from public, anon;
grant execute on function public.my_left_households() to authenticated;
