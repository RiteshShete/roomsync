import type { NotificationPrefs } from '@/api/activity';
import { copy } from '@/copy';
import { NOTIFICATION_CATEGORIES, categoryEnabled } from '@/domain';

/** The database stores times as HH:MM:SS; the time input wants HH:MM. */
export const toHHMM = (t: string | null): string => (t ? t.slice(0, 5) : '');

export interface PrefsDraft {
  /** One entry per category: true = shown. */
  categories: Record<(typeof NOTIFICATION_CATEGORIES)[number], boolean>;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}

export function draftFromPrefs(p: NotificationPrefs): PrefsDraft {
  return {
    categories: Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, categoryEnabled(p.categories, c)])) as PrefsDraft['categories'],
    quietEnabled: p.quietEnabled,
    quietStart: toHHMM(p.quietStart),
    quietEnd: toHHMM(p.quietEnd),
  };
}

export interface PrefsCheck {
  ok: boolean;
  reason: string | null;
  input: NotificationPrefs | null;
}

/**
 * Only switched-OFF categories are stored (a missing key means on), so new categories default to
 * visible. Quiet times are kept even when the switch is off, so turning it back on remembers them.
 */
export function checkPrefs(draft: PrefsDraft, saved: NotificationPrefs): PrefsCheck {
  if (draft.quietEnabled && (draft.quietStart === '' || draft.quietEnd === '')) return { ok: false, reason: copy.notificationPrefs.reasonTimes, input: null };
  const categories = Object.fromEntries(NOTIFICATION_CATEGORIES.filter((c) => !draft.categories[c]).map((c) => [c, false]));
  const input: NotificationPrefs = {
    categories,
    quietEnabled: draft.quietEnabled,
    quietStart: draft.quietStart === '' ? null : draft.quietStart,
    quietEnd: draft.quietEnd === '' ? null : draft.quietEnd,
  };
  const same =
    JSON.stringify(input.categories) === JSON.stringify(Object.fromEntries(NOTIFICATION_CATEGORIES.filter((c) => !categoryEnabled(saved.categories, c)).map((c) => [c, false]))) &&
    input.quietEnabled === saved.quietEnabled &&
    toHHMM(input.quietStart) === toHHMM(saved.quietStart) &&
    toHHMM(input.quietEnd) === toHHMM(saved.quietEnd);
  return same ? { ok: false, reason: copy.notificationPrefs.reasonSame, input: null } : { ok: true, reason: null, input };
}
