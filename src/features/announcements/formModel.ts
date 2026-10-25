import type { AnnouncementInput } from '@/api/announcements';
import { copy } from '@/copy';

export const TITLE_MAX = 120;
export const BODY_MAX = 4000;

export interface AnnouncementDraft {
  title: string;
  body: string;
}

export interface AnnouncementCheck {
  ok: boolean;
  /** Why Save is disabled; null when it is enabled. */
  reason: string | null;
  input: AnnouncementInput | null;
}

/** Validates the compose/edit form. `original` is set when editing, so an unchanged form can't be saved. */
export function checkAnnouncement(draft: AnnouncementDraft, original?: AnnouncementInput): AnnouncementCheck {
  const input = { title: draft.title.trim(), body: draft.body.trim() };
  const fail = (reason: string): AnnouncementCheck => ({ ok: false, reason, input: null });
  if (input.title === '') return fail(copy.announcements.reasonTitle);
  if (input.body === '') return fail(copy.announcements.reasonMessage);
  if (input.title.length > TITLE_MAX) return fail(copy.announcements.reasonTitleLong);
  if (input.body.length > BODY_MAX) return fail(copy.announcements.reasonMessageLong);
  if (original && original.title === input.title && original.body === input.body) return fail(copy.announcements.reasonSame);
  return { ok: true, reason: null, input };
}
