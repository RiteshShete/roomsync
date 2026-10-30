-- Household group chat: plain text only, no media, no edits. Kept small on purpose (the project runs on a
-- small free database): messages older than 7 days are removed, and only the newest 300 per household are
-- kept. Pruning runs a little at a time inside the daily reminder sync, like the other short-lived tables.
-- No read receipts are stored: "unread" is a time kept in each person's own browser.

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  sender_member_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key (sender_member_id, household_id) references public.household_members (id, household_id)
);

create index chat_messages_household_created_idx on public.chat_messages (household_id, created_at desc);

alter table public.chat_messages enable row level security;

-- Members (active or leaving) read their own household's messages; people who left lose access.
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (private.is_member(household_id));
-- Send only as yourself, only into your own household, and only while it is active (archived = read-only).
create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (
    private.is_member(household_id) and private.household_is_active(household_id)
    and sender_member_id = private.my_member_id(household_id)
  );

grant select on public.chat_messages to authenticated;
grant insert (household_id, sender_member_id, body) on public.chat_messages to authenticated;

alter publication supabase_realtime add table public.chat_messages;

create or replace function private.prune_old_rows(p_hid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.activity_events
   where id in (select id from public.activity_events
                 where household_id = p_hid and created_at < now() - interval '90 days'
                 order by created_at limit 500);
  delete from public.invite_attempts
   where id in (select id from public.invite_attempts
                 where attempted_at < now() - interval '1 day'
                 order by attempted_at limit 500);
  delete from public.chat_messages
   where id in (select id from public.chat_messages
                 where household_id = p_hid and created_at < now() - interval '7 days'
                 order by created_at limit 500);
  delete from public.chat_messages
   where id in (select id from public.chat_messages
                 where household_id = p_hid
                 order by created_at desc offset 300 limit 500);
end;
$$;
