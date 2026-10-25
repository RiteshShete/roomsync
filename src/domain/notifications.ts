/** Activity-centre rules: categories, per-person visibility, quiet hours and unread counts. Pure. */

export const NOTIFICATION_CATEGORIES = ['expenses', 'settlements', 'chores', 'groceries', 'announcements', 'household'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface ActivityEventLike {
  id: string;
  eventType: string;
  actorMemberId: string | null;
  recipientMemberIds: string[];
  createdAt: string;
}

/** "chore.assigned" → chores. Unknown prefixes land in household so nothing is silently dropped. */
export function categoryOf(eventType: string): NotificationCategory {
  switch (eventType.split('.')[0]) {
    case 'expense':
      return 'expenses';
    case 'settlement':
      return 'settlements';
    case 'chore':
      return 'chores';
    case 'grocery':
      return 'groceries';
    case 'announcement':
      return 'announcements';
    default:
      return 'household';
  }
}

/** A missing key means "on": new categories and fresh accounts default to showing everything. */
export type CategoryPrefs = Partial<Record<NotificationCategory, boolean>>;

export const categoryEnabled = (prefs: CategoryPrefs, c: NotificationCategory) => prefs[c] !== false;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
};

/**
 * Is `minutes` (minutes since local midnight) inside the quiet window? Windows may cross midnight
 * (22:00 → 07:00). Start inclusive, end exclusive. Equal start and end is an empty window.
 */
export function inQuietHours(minutes: number, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

export interface QuietPrefs {
  quietEnabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}

/**
 * Events this person is allowed to see in the activity centre: addressed to them, in an enabled
 * category, newest first.
 */
export function visibleEvents<T extends ActivityEventLike>(events: T[], memberId: string, categories: CategoryPrefs): T[] {
  return events
    .filter((e) => e.recipientMemberIds.includes(memberId) && categoryEnabled(categories, categoryOf(e.eventType)))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
}

/**
 * The unread badge. Quiet hours pause only the badge (the events are still listed and still count
 * once the window ends); there is no push, so that is all "quiet" can mean.
 */
export function unreadCount<T extends ActivityEventLike>(
  events: T[],
  memberId: string,
  readIds: ReadonlySet<string>,
  categories: CategoryPrefs,
  quiet: QuietPrefs,
  nowMinutes: number,
): number {
  if (quiet.quietEnabled && inQuietHours(nowMinutes, quiet.quietStart, quiet.quietEnd)) return 0;
  return visibleEvents(events, memberId, categories).filter((e) => !readIds.has(e.id)).length;
}
