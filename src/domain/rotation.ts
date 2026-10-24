import { addDays, addMonths } from './dates';
import type { MemberId, RecurrenceFrequency } from './types';

/**
 * Next due date after `due` for the recurrence. Never in the past: if the natural next date is
 * before `today`, keep stepping forward until it is `>= today`. Mirrored in SQL `complete_chore`.
 */
export function nextOccurrence(due: string, freq: RecurrenceFrequency, today: string): string {
  const step = (d: string, n: number) => {
    switch (freq) {
      case 'daily': return addDays(d, n);
      case 'weekly': return addDays(d, 7 * n);
      case 'biweekly': return addDays(d, 14 * n);
      case 'monthly': return addMonths(due, n); // anchor on the original day-of-month
    }
  };
  let n = 1;
  let next = step(due, n);
  while (next < today) next = step(due, ++n);
  return next;
}

export interface NextAssignee {
  assignee: MemberId | null;
  /** Members passed over because they are not active. */
  skipped: MemberId[];
}

/**
 * Next assignee after `current` in the rotation list, skipping non-active members.
 * Returns null when no active member exists (chore left unassigned; admins get notified).
 * If `current` is not in the list, rotation starts from the first entry.
 */
export function nextAssignee(
  rotation: MemberId[],
  current: MemberId | null,
  activeIds: ReadonlySet<MemberId>,
): NextAssignee {
  const n = rotation.length;
  if (n === 0) return { assignee: null, skipped: [] };
  const start = current === null ? -1 : rotation.indexOf(current);
  const skipped: MemberId[] = [];
  for (let k = 1; k <= n; k++) {
    const candidate = rotation[(start + k + n) % n]!;
    if (activeIds.has(candidate)) return { assignee: candidate, skipped };
    skipped.push(candidate);
  }
  return { assignee: null, skipped };
}

/** Remove departed members; a rotation with fewer than 2 members becomes null. */
export function pruneRotation(rotation: MemberId[], activeIds: ReadonlySet<MemberId>): MemberId[] | null {
  const kept = rotation.filter((m) => activeIds.has(m));
  return kept.length < 2 ? null : kept;
}
