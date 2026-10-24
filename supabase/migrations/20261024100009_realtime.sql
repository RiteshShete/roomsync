-- Realtime only for tables the UI subscribes to. RLS still filters what each subscriber receives.

alter publication supabase_realtime add table
  public.activity_events, public.expenses, public.settlements,
  public.chores, public.grocery_items, public.announcements;
