-- Helper predicates used by RLS policies and RPCs. All are security definer with an empty
-- search_path so policies never query a protected table under RLS (no recursion) and can't be
-- hijacked via search_path. Each one derives the caller from auth.uid() itself.

-- Non-left member (active or leaving): may read household data.
create function private.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.status <> 'left'
  );
$$;

-- Strictly `active` (not leaving, not left).
create function private.is_active_member(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create function private.is_admin(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
      and m.status <> 'left' and m.role in ('owner', 'admin')
  );
$$;

create function private.my_member_id(hid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.household_members m
  where m.household_id = hid and m.user_id = (select auth.uid()) and m.status <> 'left'
  limit 1;
$$;

-- True when `mid` is one of the caller's own member rows.
create function private.is_my_member(mid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.id = mid and m.user_id = (select auth.uid())
  );
$$;

-- True when `mid` belongs to a household the caller is a (non-left) member of.
create function private.is_member_of_member(mid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.id = mid and private.is_member(m.household_id)
  );
$$;

create function private.household_is_active(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.households h where h.id = hid and h.status = 'active');
$$;

-- New expenses/chores may only involve active or leaving members of that household.
create function private.is_assignable_member(mid uuid, hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.id = mid and m.household_id = hid and m.status in ('active', 'leaving')
  );
$$;

create function private.all_members_in_household(mids uuid[], hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.household_members m
          where m.id = any (mids) and m.household_id = hid and m.status in ('active', 'leaving'))
         = (select count(distinct x) from unnest(mids) x);
$$;

-- Profiles are visible to the owner and to people the caller shares (or shared) a household with.
create function private.shares_household_with(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid()) and mine.status <> 'left' and theirs.user_id = uid
  );
$$;
