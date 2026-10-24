-- Row level security. Read access = non-left member of the row's household. Writes happen through
-- RPCs (security definer, Phase 2) except the tables listed under "direct writes" below, where the
-- policy + column grants + triggers define exactly what a member may do.
-- Tables with no policy for a command deny that command (no policy = no access).

-- profiles: own row, or people sharing (or who shared) a household with the caller.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_household_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Read-only (writes via RPC)
create policy households_select on public.households for select to authenticated
  using (private.is_member(id));
create policy household_members_select on public.household_members for select to authenticated
  using (private.is_member(household_id));
create policy member_move_out_disputes_select on public.member_move_out_disputes for select to authenticated
  using (private.is_member_of_member(member_id));
create policy invitations_select on public.invitations for select to authenticated
  using (private.is_admin(household_id));
create policy expenses_select on public.expenses for select to authenticated
  using (private.is_member(household_id));
create policy expense_shares_select on public.expense_shares for select to authenticated
  using (private.is_member(household_id));
create policy settlements_select on public.settlements for select to authenticated
  using (private.is_member(household_id));
create policy chore_completions_select on public.chore_completions for select to authenticated
  using (private.is_member(household_id));
create policy activity_events_select on public.activity_events for select to authenticated
  using (private.is_member(household_id));
create policy audit_events_select on public.audit_events for select to authenticated
  using (private.is_member(household_id));
create policy activity_reads_select on public.activity_reads for select to authenticated
  using (private.is_my_member(member_id));
-- invite_attempts: no policies at all; only RPCs touch it.

-- Direct writes: chores
create policy chores_select on public.chores for select to authenticated
  using (private.is_member(household_id));
create policy chores_insert on public.chores for insert to authenticated
  with check (
    private.is_member(household_id) and private.household_is_active(household_id)
    and created_by = (select auth.uid())
    and status = 'open'
    and (assignee_member_id is null or private.is_assignable_member(assignee_member_id, household_id))
    and (rotation_member_ids is null or private.all_members_in_household(rotation_member_ids, household_id))
  );
-- Only open chores are editable directly; completing/reopening goes through RPCs.
-- Edit/reassign: admin, creator or assignee. Cancel: admin or creator.
create policy chores_update on public.chores for update to authenticated
  using (
    private.is_member(household_id) and private.household_is_active(household_id)
    and status = 'open'
    and (private.is_admin(household_id)
         or created_by = (select auth.uid())
         or assignee_member_id = private.my_member_id(household_id))
  )
  with check (
    private.is_member(household_id) and private.household_is_active(household_id)
    and status in ('open', 'cancelled')
    and (status = 'open' or private.is_admin(household_id) or created_by = (select auth.uid()))
    and (assignee_member_id is null or private.is_assignable_member(assignee_member_id, household_id))
    and (rotation_member_ids is null or private.all_members_in_household(rotation_member_ids, household_id))
  );

-- Direct writes: grocery items (any member; delete is a soft delete via deleted_at)
create policy grocery_items_select on public.grocery_items for select to authenticated
  using (private.is_member(household_id));
create policy grocery_items_insert on public.grocery_items for insert to authenticated
  with check (
    private.is_member(household_id) and private.household_is_active(household_id)
    and added_by_member_id = private.my_member_id(household_id)
    and status = 'needed' and deleted_at is null
  );
create policy grocery_items_update on public.grocery_items for update to authenticated
  using (private.is_member(household_id) and private.household_is_active(household_id))
  with check (private.is_member(household_id) and private.household_is_active(household_id));

-- Direct writes: announcements (admin/owner any; author own; pin guarded by trigger)
create policy announcements_select on public.announcements for select to authenticated
  using (private.is_member(household_id));
create policy announcements_insert on public.announcements for insert to authenticated
  with check (
    private.is_member(household_id) and private.household_is_active(household_id)
    and created_by = (select auth.uid())
    and (pinned_at is null or private.is_admin(household_id))
    and deleted_at is null
  );
create policy announcements_update on public.announcements for update to authenticated
  using (
    private.is_member(household_id) and private.household_is_active(household_id)
    and (private.is_admin(household_id) or created_by = (select auth.uid()))
  )
  with check (private.is_member(household_id) and private.household_is_active(household_id));

-- Own notification preferences
create policy notification_prefs_select on public.notification_prefs for select to authenticated
  using (private.is_my_member(member_id));
create policy notification_prefs_update on public.notification_prefs for update to authenticated
  using (private.is_my_member(member_id)) with check (private.is_my_member(member_id));
