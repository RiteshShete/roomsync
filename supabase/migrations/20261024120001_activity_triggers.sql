-- Activity events for the tables members write to directly (chores, grocery items). PLAN §6:
-- "written only by RPCs/triggers". RPCs emit their own events, so these triggers stay silent when a
-- write comes from inside an RPC. Every RPC enters through private.ctx(), which now sets a
-- transaction-local flag; direct table writes never pass through it.

create or replace function private.ctx(p_hid uuid, p_write boolean default true)
returns public.household_members language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid(); m public.household_members;
begin
  perform set_config('roomsync.in_rpc', 'on', true);
  perform private.reconcile(p_hid);
  select * into m from public.household_members
   where household_id = p_hid and user_id = u and status <> 'left';
  if not found then raise exception 'not_found'; end if;
  if p_write and exists (select 1 from public.households h where h.id = p_hid and h.status = 'archived') then
    raise exception 'household_archived';
  end if;
  return m;
end;
$$;

-- reconcile_household does not go through ctx (a member who just left must still be able to call it).
create or replace function public.reconcile_household(p_household_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid();
begin
  if not exists (select 1 from public.household_members where household_id = p_household_id and user_id = u) then
    raise exception 'not_found';
  end if;
  perform set_config('roomsync.in_rpc', 'on', true);
  return private.reconcile(p_household_id);
end;
$$;

create function private.chore_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid; assignee_only uuid[]; edited boolean;
begin
  if current_setting('roomsync.in_rpc', true) = 'on' then return null; end if;
  actor := private.my_member_id(new.household_id);
  assignee_only := case when new.assignee_member_id is null then '{}'::uuid[] else array[new.assignee_member_id] end;

  if tg_op = 'INSERT' then
    perform private.emit_activity(new.household_id, actor, 'chore.created', 'chore', new.id,
      jsonb_build_object('title', new.title, 'due_date', new.due_date), assignee_only);
  elsif old.status = 'open' and new.status = 'cancelled' then
    perform private.emit_activity(new.household_id, actor, 'chore.cancelled', 'chore', new.id,
      jsonb_build_object('title', new.title), assignee_only);
  elsif old.status = 'open' and new.status = 'open' then
    if new.assignee_member_id is distinct from old.assignee_member_id and new.assignee_member_id is not null then
      perform private.emit_activity(new.household_id, actor, 'chore.assigned', 'chore', new.id,
        jsonb_build_object('title', new.title, 'due_date', new.due_date), assignee_only);
    end if;
    edited := new.title is distinct from old.title or new.description is distinct from old.description
           or new.due_date is distinct from old.due_date
           or new.recurrence_frequency is distinct from old.recurrence_frequency
           or new.rotation_member_ids is distinct from old.rotation_member_ids;
    if edited then
      perform private.emit_activity(new.household_id, actor, 'chore.edited', 'chore', new.id,
        jsonb_build_object('title', new.title, 'due_date', new.due_date), assignee_only);
    end if;
  end if;
  return null;
end;
$$;

create trigger chores_activity
  after insert or update on public.chores
  for each row execute function private.chore_activity();

create function private.grocery_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  if current_setting('roomsync.in_rpc', true) = 'on' then return null; end if;
  actor := private.my_member_id(new.household_id);

  if tg_op = 'INSERT' then
    perform private.emit_activity(new.household_id, actor, 'grocery.added', 'grocery_item', new.id,
      jsonb_build_object('name', new.name), private.member_ids(new.household_id, actor));
  elsif old.deleted_at is null and new.deleted_at is not null then
    perform private.emit_activity(new.household_id, actor, 'grocery.deleted', 'grocery_item', new.id,
      jsonb_build_object('name', new.name), array[new.added_by_member_id]);
  elsif old.deleted_at is not null and new.deleted_at is null then
    perform private.emit_activity(new.household_id, actor, 'grocery.restored', 'grocery_item', new.id,
      jsonb_build_object('name', new.name), array[new.added_by_member_id]);
  elsif old.status = 'needed' and new.status = 'purchased' then
    perform private.emit_activity(new.household_id, actor, 'grocery.purchased', 'grocery_item', new.id,
      jsonb_build_object('name', new.name), array[new.added_by_member_id]);
  elsif old.status = 'purchased' and new.status = 'needed' then
    perform private.emit_activity(new.household_id, actor, 'grocery.moved_back', 'grocery_item', new.id,
      jsonb_build_object('name', new.name), array[new.added_by_member_id]);
  end if;
  return null;
end;
$$;

create trigger grocery_items_activity
  after insert or update on public.grocery_items
  for each row execute function private.grocery_activity();

revoke all on function private.chore_activity(), private.grocery_activity() from public, anon, authenticated;
