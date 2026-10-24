-- Privileges. Default is "nothing"; grant only what the UI needs and RLS then narrows per row.
-- `anon` gets nothing at all. No role gets DELETE anywhere (deletes are soft, via RPC/columns).
-- Money tables, members, invitations, activity and audit have no direct write privilege: RPC only.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.profiles, public.households, public.household_members, public.member_move_out_disputes,
  public.expenses, public.expense_shares, public.settlements, public.chores, public.chore_completions,
  public.grocery_items, public.announcements, public.activity_events, public.activity_reads,
  public.audit_events, public.notification_prefs
to authenticated;

-- code_hash never leaves the database.
grant select (id, household_id, created_by, code_hint, expires_at, max_uses, use_count, status, created_at)
  on public.invitations to authenticated;

-- Column-level write grants: columns not listed can only be set by RPCs or defaults.
grant update (display_name, avatar_color) on public.profiles to authenticated;

grant insert (household_id, title, description, assignee_member_id, due_date, recurrence_frequency,
              rotation_member_ids, created_by)
  on public.chores to authenticated;
grant update (title, description, assignee_member_id, due_date, recurrence_frequency,
              rotation_member_ids, status, cancel_reason)
  on public.chores to authenticated;

grant insert (household_id, name, quantity, unit, category, note, added_by_member_id)
  on public.grocery_items to authenticated;
grant update (name, quantity, unit, category, note, status, purchased_by_member_id, purchased_at, deleted_at)
  on public.grocery_items to authenticated;

grant insert (household_id, title, body, created_by, pinned_at) on public.announcements to authenticated;
grant update (title, body, pinned_at, deleted_at) on public.announcements to authenticated;

grant update (categories, quiet_enabled, quiet_start, quiet_end) on public.notification_prefs to authenticated;

-- Functions: nothing is callable by PUBLIC/anon. Policies call these as `authenticated`.
revoke all on all functions in schema private from public, anon;
grant execute on function
  private.is_member(uuid), private.is_active_member(uuid), private.is_admin(uuid),
  private.my_member_id(uuid), private.is_my_member(uuid), private.is_member_of_member(uuid),
  private.household_is_active(uuid), private.is_assignable_member(uuid, uuid),
  private.all_members_in_household(uuid[], uuid), private.shares_household_with(uuid)
to authenticated;
