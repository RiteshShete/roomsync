import { getSupabase } from '@/lib/supabase';

/**
 * Tables whose changes the UI reacts to; each must be in the supabase_realtime publication (migration
 * ...100009_realtime), because one unpublished table makes the server reject the whole subscription.
 * Member changes arrive as activity_events. Row-level security still decides which rows a client receives.
 */
const TABLES = ['expenses', 'settlements', 'chores', 'grocery_items', 'announcements', 'activity_events'] as const;

export type RealtimeStatus = 'connecting' | 'live' | 'down';

/**
 * Listens for household-scoped changes. `onChange` fires for any insert/update/delete; `onStatus`
 * reports whether the channel is healthy so the caller can fall back to polling. Returns an unsubscribe.
 */
export function subscribeToHousehold(householdId: string, onChange: () => void, onStatus: (s: RealtimeStatus) => void): () => void {
  const supabase = getSupabase();
  let channel = supabase.channel(`household:${householdId}`);
  for (const table of TABLES) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, onChange);
  }
  onStatus('connecting');
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') onStatus('live');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus('down');
  });
  return () => {
    void supabase.removeChannel(channel);
  };
}
