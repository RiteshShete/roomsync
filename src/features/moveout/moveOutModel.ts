import { checkMoveOutDate } from '@/domain';
import { copy } from '@/copy';

export const NOTE_MAX = 1000;

export interface MoveOutDraft {
  date: string;
  note: string;
  understood: boolean;
}

export interface MoveOutCheck {
  ok: boolean;
  /** Why "Leave household" is disabled; null when enabled. */
  reason: string | null;
  input: { effectiveDate: string; note: string | null } | null;
}

/** Validates the leave form: a valid date, a short-enough note, and the explicit confirmation. */
export function checkMoveOut(draft: MoveOutDraft, today: string): MoveOutCheck {
  const fail = (reason: string): MoveOutCheck => ({ ok: false, reason, input: null });
  const problem = checkMoveOutDate(draft.date, today);
  if (problem) return fail(copy.moveOut.dateReasons[problem]!);
  const note = draft.note.trim();
  if (note.length > NOTE_MAX) return fail(copy.moveOut.noteReasonLong);
  if (!draft.understood) return fail(copy.moveOut.reasonUnderstand);
  return { ok: true, reason: null, input: { effectiveDate: draft.date, note: note === '' ? null : note } };
}

export interface NoteCheck {
  ok: boolean;
  reason: string | null;
  note: string | null;
}

/** Validates a note or dispute added after the move-out has started. */
export function checkNote(text: string): NoteCheck {
  const note = text.trim();
  if (note === '') return { ok: false, reason: copy.moveOut.noteReasonEmpty, note: null };
  if (note.length > NOTE_MAX) return { ok: false, reason: copy.moveOut.noteReasonLong, note: null };
  return { ok: true, reason: null, note };
}
