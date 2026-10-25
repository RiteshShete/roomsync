import { addDays, daysBetween, isIsoDate } from './dates';

/** How far ahead a move-out date may be set (mirrors the database check in start_move_out). */
export const MAX_MOVE_OUT_DAYS = 90;

export type MoveOutDateProblem = 'missing' | 'invalid' | 'past' | 'tooFar';

/** Null when `date` is a valid effective date: today through 90 days from today. */
export function checkMoveOutDate(date: string, today: string): MoveOutDateProblem | null {
  if (date === '') return 'missing';
  if (!isIsoDate(date)) return 'invalid';
  if (date < today) return 'past';
  if (date > addDays(today, MAX_MOVE_OUT_DAYS)) return 'tooFar';
  return null;
}

export const latestMoveOutDate = (today: string): string => addDays(today, MAX_MOVE_OUT_DAYS);

export type MoveOutTiming = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'inDays'; days: number } | { kind: 'passed' };

/** How to phrase when a move-out takes effect. A date in the past means it has already happened. */
export function moveOutTiming(effective: string, today: string): MoveOutTiming {
  const days = daysBetween(today, effective);
  if (days < 0) return { kind: 'passed' };
  if (days === 0) return { kind: 'today' };
  if (days === 1) return { kind: 'tomorrow' };
  return { kind: 'inDays', days };
}
