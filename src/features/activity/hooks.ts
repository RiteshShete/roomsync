import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getNotificationPrefs, listActivity, listReadIds, syncChoreReminders } from '@/api/activity';
import { inQuietHours, minutesOfDay, todayIso, unreadCount, visibleEvents, type CategoryPrefs } from '@/domain';
import { useHouseholdAccess } from '@/features/household/useMembership';

const ACTIVITY = 'activity';
const READS = 'activity-reads';
const PREFS = 'notification-prefs';

export function useInvalidateActivity() {
  const client = useQueryClient();
  return () => Promise.all([ACTIVITY, READS, PREFS].map((k) => client.invalidateQueries({ queryKey: [k] })));
}

/** Re-renders once a minute so quiet hours switch on and off without a reload. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function useNotificationPrefs(memberId: string | undefined) {
  return useQuery({ queryKey: [PREFS, memberId], queryFn: () => getNotificationPrefs(memberId!), enabled: !!memberId, staleTime: 0 });
}

/**
 * Everything the bell, the activity centre and Home need: the events this person may see, which are
 * read, the unread count (paused during quiet hours) and the query state.
 */
export function useNotifications() {
  const access = useHouseholdAccess();
  const events = useQuery({ queryKey: [ACTIVITY, access?.householdId], queryFn: () => listActivity(access!.householdId), enabled: !!access, staleTime: 0 });
  const reads = useQuery({ queryKey: [READS, access?.memberId], queryFn: () => listReadIds(access!.memberId), enabled: !!access, staleTime: 0 });
  const prefs = useNotificationPrefs(access?.memberId);
  const now = useMinuteClock();

  return useMemo(() => {
    const categories: CategoryPrefs = prefs.data?.categories ?? {};
    const quiet = { quietEnabled: prefs.data?.quietEnabled ?? false, quietStart: prefs.data?.quietStart ?? null, quietEnd: prefs.data?.quietEnd ?? null };
    const readIds = new Set(reads.data ?? []);
    const all = events.data ?? [];
    const memberId = access?.memberId ?? '';
    return {
      events: all,
      mine: visibleEvents(all, memberId, categories),
      readIds,
      unread: unreadCount(all, memberId, readIds, categories, quiet, minutesOfDay(now)),
      quietNow: quiet.quietEnabled && inQuietHours(minutesOfDay(now), quiet.quietStart, quiet.quietEnd),
      isPending: events.isPending || reads.isPending || prefs.isPending,
      error: events.error ?? reads.error ?? prefs.error,
      refetch: () => Promise.all([events.refetch(), reads.refetch(), prefs.refetch()]),
    };
  }, [access?.memberId, events, reads, prefs, now]);
}

/** Props for the header bell: shows the unread count and opens the activity centre. */
export function useBell() {
  const { unread } = useNotifications();
  const navigate = useNavigate();
  return { unread, onClick: () => navigate('/activity') };
}

/** Which household-days this app instance (query client) has already asked about. */
const syncedByClient = new WeakMap<QueryClient, Set<string>>();

/**
 * Creates today's in-app chore reminders the first time this device opens the household each day.
 * Reminders are best-effort: if the call fails it is retried the next time the shell mounts, and
 * nothing the user is doing is interrupted.
 */
export function useReminderSync(householdId: string | undefined, archived: boolean) {
  const client = useQueryClient();
  const invalidate = useInvalidateActivity();
  useEffect(() => {
    if (!householdId || archived) return;
    const synced = syncedByClient.get(client) ?? new Set<string>();
    syncedByClient.set(client, synced);
    const key = `${householdId}:${todayIso()}`;
    if (synced.has(key)) return;
    synced.add(key);
    syncChoreReminders(householdId, todayIso())
      .then((created) => (created > 0 ? invalidate() : undefined))
      .catch(() => synced.delete(key));
  }, [householdId, archived]);
}
