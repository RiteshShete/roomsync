import type { ActivityEventLike, CategoryPrefs, QuietPrefs } from '@/domain';
import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export interface ActivityEvent extends ActivityEventLike {
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
}

const FEED_LIMIT = 100;

/** The household's most recent events. RLS shows every member the same events; addressing is client-side. */
export async function listActivity(householdId: string): Promise<ActivityEvent[]> {
  const { data, error } = await getSupabase()
    .from('activity_events')
    .select('id, event_type, actor_member_id, entity_type, entity_id, metadata, recipient_member_ids, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw toAppError(error);
  return data.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    actorMemberId: r.actor_member_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    recipientMemberIds: r.recipient_member_ids,
    createdAt: r.created_at,
  }));
}

/** Ids of the events this member has read (their own rows only; RLS). */
export async function listReadIds(memberId: string): Promise<string[]> {
  const { data, error } = await getSupabase().from('activity_reads').select('event_id').eq('member_id', memberId).limit(1000);
  if (error) throw toAppError(error);
  return data.map((r) => r.event_id);
}

export async function markActivityRead(eventId: string): Promise<void> {
  const { error } = await getSupabase().rpc('mark_activity_read', { p_event_id: eventId });
  if (error) throw toAppError(error);
}

export async function markAllActivityRead(householdId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('mark_all_activity_read', { p_household_id: householdId });
  if (error) throw toAppError(error);
  return data;
}

/** Creates today's in-app chore reminders (idempotent; see the sync_chore_reminders migration). */
export async function syncChoreReminders(householdId: string, today: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('sync_chore_reminders', { p_household_id: householdId, p_today: today });
  if (error) throw toAppError(error);
  return data;
}

export interface NotificationPrefs extends QuietPrefs {
  categories: CategoryPrefs;
}

export async function getNotificationPrefs(memberId: string): Promise<NotificationPrefs> {
  const { data, error } = await getSupabase()
    .from('notification_prefs')
    .select('categories, quiet_enabled, quiet_start, quiet_end')
    .eq('member_id', memberId)
    .single();
  if (error) throw toAppError(error);
  return {
    categories: (data.categories ?? {}) as CategoryPrefs,
    quietEnabled: data.quiet_enabled,
    quietStart: data.quiet_start,
    quietEnd: data.quiet_end,
  };
}

export async function saveNotificationPrefs(memberId: string, prefs: NotificationPrefs): Promise<void> {
  const { error } = await getSupabase()
    .from('notification_prefs')
    .update({ categories: prefs.categories, quiet_enabled: prefs.quietEnabled, quiet_start: prefs.quietStart, quiet_end: prefs.quietEnd })
    .eq('member_id', memberId);
  if (error) throw toAppError(error);
}
