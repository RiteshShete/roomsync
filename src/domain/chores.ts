import { isOverdue } from './dates';

export type ChoreBucket = 'today' | 'upcoming';

/**
 * Which list an OPEN chore belongs in. "Today" holds anything due today or already past due (so
 * nothing quietly disappears); "Upcoming" holds future-dated and undated chores.
 */
export function choreBucket(due: string | null, today: string): ChoreBucket {
  return due !== null && due <= today ? 'today' : 'upcoming';
}

export type DueKind = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later' | 'none';

export interface DueInfo {
  kind: DueKind;
  /** Whole days from today to the due date (negative = past). Null when undated. */
  days: number | null;
}

/** Calendar-day distance between two ISO dates (UTC arithmetic, DST-proof). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function dueInfo(due: string | null, today: string): DueInfo {
  if (due === null) return { kind: 'none', days: null };
  const days = daysBetween(today, due);
  if (isOverdue(due, today)) return { kind: 'overdue', days };
  if (days === 0) return { kind: 'today', days };
  if (days === 1) return { kind: 'tomorrow', days };
  return { kind: days <= 7 ? 'soon' : 'later', days };
}
