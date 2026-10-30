-- Phase 9 (performance): two list queries sorted on a column no index covered, so they read and sorted
-- every row of a household to return one page (see scripts/explain-lists.sql). Both indexes are partial,
-- so they only hold the rows those lists actually show.

-- "Latest completed chores": status = 'completed' order by completed_at desc limit 50
create index chores_household_completed_idx
  on public.chores (household_id, completed_at desc)
  where status = 'completed';

-- Announcements, pinned first: deleted_at is null order by pinned_at desc nulls last, created_at desc
create index announcements_household_pinned_idx
  on public.announcements (household_id, pinned_at desc nulls last, created_at desc)
  where deleted_at is null;
