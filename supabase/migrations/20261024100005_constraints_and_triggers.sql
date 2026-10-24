-- Invariants that plain column constraints can't express.
-- Error convention: invariant violations raise check_violation (23514) with message
-- 'validation:<field>:<code>'; vocabulary errors (currency_locked, permission_denied) use P0001.

-- D6: one non-left membership per user. One non-left owner per household.
create unique index household_members_one_active_membership
  on public.household_members (user_id) where status <> 'left';
create unique index household_members_one_owner
  on public.household_members (household_id) where role = 'owner' and status <> 'left';

-- A household with members must have an owner by the time the transaction commits
-- (deferred, so ownership transfer can demote then promote in one transaction).
create function private.check_household_has_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := case when tg_op = 'DELETE' then old.household_id else new.household_id end;
begin
  if exists (select 1 from public.household_members where household_id = hid and status <> 'left')
     and not exists (select 1 from public.household_members
                     where household_id = hid and role = 'owner' and status <> 'left') then
    raise exception 'validation:owner:required' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger household_requires_owner
  after insert or update or delete on public.household_members
  deferrable initially deferred
  for each row execute function private.check_household_has_owner();

-- D9: currency is fixed once any expense or settlement exists, and every money row must use the
-- household's currency.
create function private.lock_currency()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.currency_code is distinct from old.currency_code
     and (exists (select 1 from public.expenses where household_id = old.id)
          or exists (select 1 from public.settlements where household_id = old.id)) then
    raise exception 'currency_locked';
  end if;
  return new;
end;
$$;

create trigger households_lock_currency
  before update of currency_code on public.households
  for each row execute function private.lock_currency();

create function private.check_money_currency()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.currency_code is distinct from
     (select h.currency_code from public.households h where h.id = new.household_id) then
    raise exception 'validation:currency_code:mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expenses_currency_matches
  before insert or update of currency_code, household_id on public.expenses
  for each row execute function private.check_money_currency();
create trigger settlements_currency_matches
  before insert or update of currency_code, household_id on public.settlements
  for each row execute function private.check_money_currency();

-- Split invariants, checked at commit so an expense and its shares can be written together.
-- Payer/participant household membership is enforced by the composite foreign keys.
create function private.check_expense_invariants()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  eid uuid;
  e public.expenses%rowtype;
  cnt int; total bigint; mn bigint; mx bigint; bp_total bigint;
  bad_method int; bad_round int;
begin
  if tg_op = 'DELETE' then eid := old.expense_id;
  elsif tg_table_name = 'expenses' then eid := new.id;
  else eid := new.expense_id;
  end if;

  select * into e from public.expenses where id = eid;
  if not found then return null; end if;

  select count(*), coalesce(sum(share_amount_minor), 0), coalesce(min(share_amount_minor), 0),
         coalesce(max(share_amount_minor), 0), coalesce(sum(percent_bp), 0),
         count(*) filter (where split_method <> e.split_method),
         count(*) filter (where e.split_method = 'percentage'
                          and abs(share_amount_minor * 10000 - e.amount_minor * coalesce(percent_bp, 0)) >= 10000)
    into cnt, total, mn, mx, bp_total, bad_method, bad_round
    from public.expense_shares where expense_id = eid;

  if cnt = 0 or total <> e.amount_minor then
    raise exception 'validation:shares:sum_mismatch' using errcode = '23514';
  end if;
  if bad_method > 0 then
    raise exception 'validation:shares:method_mismatch' using errcode = '23514';
  end if;
  if e.split_method = 'equal' and mx - mn > 1 then
    raise exception 'validation:shares:equal_spread' using errcode = '23514';
  end if;
  if e.split_method = 'percentage' then
    if bp_total <> 10000 then
      raise exception 'validation:shares:percent_total' using errcode = '23514';
    end if;
    if bad_round > 0 then
      raise exception 'validation:shares:percent_rounding' using errcode = '23514';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger expenses_check_invariants
  after insert or update of amount_minor, split_method, paid_by_member_id on public.expenses
  deferrable initially deferred
  for each row execute function private.check_expense_invariants();
create constraint trigger expense_shares_check_invariants
  after insert or update or delete on public.expense_shares
  deferrable initially deferred
  for each row execute function private.check_expense_invariants();

-- Optimistic-concurrency version and updated_at.
create function private.bump_version()
returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger households_bump_version before update on public.households for each row execute function private.bump_version();
create trigger expenses_bump_version before update on public.expenses for each row execute function private.bump_version();
create trigger settlements_bump_version before update on public.settlements for each row execute function private.bump_version();
create trigger chores_bump_version before update on public.chores for each row execute function private.bump_version();
create trigger grocery_items_bump_version before update on public.grocery_items for each row execute function private.bump_version();
create trigger announcements_bump_version before update on public.announcements for each row execute function private.bump_version();

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger households_set_updated_at before update on public.households for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses for each row execute function private.set_updated_at();
create trigger chores_set_updated_at before update on public.chores for each row execute function private.set_updated_at();
create trigger grocery_items_set_updated_at before update on public.grocery_items for each row execute function private.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements for each row execute function private.set_updated_at();
create trigger notification_prefs_set_updated_at before update on public.notification_prefs for each row execute function private.set_updated_at();

-- A row can never be moved to another household.
create function private.forbid_household_change()
returns trigger language plpgsql as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'permission_denied';
  end if;
  return new;
end;
$$;

create trigger household_members_fixed_household before update on public.household_members for each row execute function private.forbid_household_change();
create trigger invitations_fixed_household before update on public.invitations for each row execute function private.forbid_household_change();
create trigger expenses_fixed_household before update on public.expenses for each row execute function private.forbid_household_change();
create trigger settlements_fixed_household before update on public.settlements for each row execute function private.forbid_household_change();
create trigger chores_fixed_household before update on public.chores for each row execute function private.forbid_household_change();
create trigger grocery_items_fixed_household before update on public.grocery_items for each row execute function private.forbid_household_change();
create trigger announcements_fixed_household before update on public.announcements for each row execute function private.forbid_household_change();

-- Grocery: a member can only mark an item purchased as themselves.
create function private.guard_grocery_purchaser()
returns trigger language plpgsql as $$
begin
  if new.purchased_by_member_id is distinct from old.purchased_by_member_id
     and new.purchased_by_member_id is not null
     and new.purchased_by_member_id is distinct from private.my_member_id(new.household_id) then
    raise exception 'permission_denied';
  end if;
  return new;
end;
$$;

create trigger grocery_items_guard_purchaser
  before update on public.grocery_items
  for each row execute function private.guard_grocery_purchaser();

-- Announcements: only admins/owner may pin or unpin.
create function private.guard_announcement_pin()
returns trigger language plpgsql as $$
begin
  if new.pinned_at is distinct from old.pinned_at and not private.is_admin(new.household_id) then
    raise exception 'permission_denied';
  end if;
  return new;
end;
$$;

create trigger announcements_guard_pin
  before update on public.announcements
  for each row execute function private.guard_announcement_pin();

-- Every member gets a default notification-preferences row.
create function private.create_default_prefs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_prefs (member_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger household_members_default_prefs
  after insert on public.household_members
  for each row execute function private.create_default_prefs();
