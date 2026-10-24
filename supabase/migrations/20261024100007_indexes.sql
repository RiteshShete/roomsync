-- Indexes on every foreign key not already covered by a primary key / unique constraint, plus
-- list-query indexes on (household_id, created_at).

create index household_members_household_idx on public.household_members (household_id);
create index household_members_user_idx on public.household_members (user_id);
create index household_members_requested_by_idx on public.household_members (move_out_requested_by);
create index member_move_out_disputes_member_idx on public.member_move_out_disputes (member_id);
create index households_created_by_idx on public.households (created_by);
create index invitations_household_idx on public.invitations (household_id, created_at desc);
create index invitations_created_by_idx on public.invitations (created_by);
create index invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at desc);

create index expenses_household_created_idx on public.expenses (household_id, created_at desc);
create index expenses_household_date_idx on public.expenses (household_id, expense_date desc);
create index expenses_paid_by_idx on public.expenses (paid_by_member_id);
create index expenses_created_by_idx on public.expenses (created_by);
create index expense_shares_member_idx on public.expense_shares (member_id);
create index expense_shares_household_idx on public.expense_shares (household_id);

create index settlements_household_created_idx on public.settlements (household_id, created_at desc);
create index settlements_from_idx on public.settlements (from_member_id);
create index settlements_to_idx on public.settlements (to_member_id);

create index chores_household_created_idx on public.chores (household_id, created_at desc);
create index chores_household_due_idx on public.chores (household_id, due_date) where status = 'open';
create index chores_assignee_idx on public.chores (assignee_member_id);
create index chores_spawned_next_idx on public.chores (spawned_next_id);
create index chore_completions_chore_idx on public.chore_completions (chore_id, household_id);
create index chore_completions_household_idx on public.chore_completions (household_id, completed_at desc);
create index chore_completions_assignee_idx on public.chore_completions (assignee_member_id);
create index chore_completions_completed_by_idx on public.chore_completions (completed_by_member_id);

create index grocery_items_household_created_idx on public.grocery_items (household_id, created_at desc);
create index grocery_items_added_by_idx on public.grocery_items (added_by_member_id);
create index grocery_items_purchased_by_idx on public.grocery_items (purchased_by_member_id);

create index announcements_household_created_idx on public.announcements (household_id, created_at desc);

create index activity_events_household_created_idx on public.activity_events (household_id, created_at desc);
create index activity_events_actor_idx on public.activity_events (actor_member_id);
create index activity_reads_event_idx on public.activity_reads (event_id);

create index audit_events_household_created_idx on public.audit_events (household_id, created_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_actor_idx on public.audit_events (actor_member_id);
