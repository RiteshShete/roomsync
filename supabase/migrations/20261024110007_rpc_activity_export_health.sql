-- Activity read state, personal data export and the keep-alive health check.

create function public.mark_activity_read(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ev public.activity_events; m public.household_members;
begin
  select * into ev from public.activity_events where id = p_event_id;
  if not found then raise exception 'not_found'; end if;
  m := private.ctx(ev.household_id, false);
  insert into public.activity_reads (member_id, event_id) values (m.id, ev.id) on conflict do nothing;
end;
$$;

-- Marks every event addressed to the caller as read. Returns how many were newly marked.
create function public.mark_all_activity_read(p_household_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare m public.household_members := private.ctx(p_household_id, false); n int;
begin
  insert into public.activity_reads (member_id, event_id)
  select m.id, e.id from public.activity_events e
   where e.household_id = p_household_id and m.id = any (e.recipient_member_ids)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Everything the caller can see in their household, as JSON. Names only for other people (no
-- emails); invitation code hashes are never included.
create function public.export_my_household_data(p_household_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.household_members := private.ctx(p_household_id, false);
begin
  return jsonb_build_object(
    'schema_version', 1,
    'exported_at', now(),
    'me', jsonb_build_object('member_id', m.id, 'role', m.role, 'status', m.status,
            'profile', (select to_jsonb(p) - 'created_at' - 'updated_at' from public.profiles p where p.id = m.user_id)),
    'household', (select to_jsonb(h) from public.households h where h.id = p_household_id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
                  'member_id', x.id, 'display_name', p.display_name, 'role', x.role, 'status', x.status,
                  'joined_at', x.joined_at, 'left_at', x.left_at) order by x.joined_at), '[]'::jsonb)
                from public.household_members x join public.profiles p on p.id = x.user_id
                where x.household_id = p_household_id),
    'expenses', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
                 from public.expenses e where e.household_id = p_household_id),
    'expense_shares', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                       from public.expense_shares s where s.household_id = p_household_id),
    'settlements', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb)
                    from public.settlements t where t.household_id = p_household_id),
    'chores', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
               from public.chores c where c.household_id = p_household_id),
    'chore_completions', (select coalesce(jsonb_agg(to_jsonb(cc) order by cc.completed_at), '[]'::jsonb)
                          from public.chore_completions cc where cc.household_id = p_household_id),
    'grocery_items', (select coalesce(jsonb_agg(to_jsonb(g) order by g.created_at), '[]'::jsonb)
                      from public.grocery_items g where g.household_id = p_household_id),
    'announcements', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
                      from public.announcements a where a.household_id = p_household_id),
    'activity_events', (select coalesce(jsonb_agg(to_jsonb(ev) order by ev.created_at), '[]'::jsonb)
                        from public.activity_events ev where ev.household_id = p_household_id),
    'audit_events', (select coalesce(jsonb_agg(to_jsonb(au) order by au.created_at), '[]'::jsonb)
                     from public.audit_events au where au.household_id = p_household_id),
    'notification_prefs', (select to_jsonb(n) from public.notification_prefs n where n.member_id = m.id)
  );
end;
$$;

-- Public keep-alive endpoint (PLAN Phase 12). Reveals nothing.
create function public.health()
returns text language sql stable set search_path = '' as $$ select 'ok'::text $$;
