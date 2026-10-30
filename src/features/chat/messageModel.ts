import { copy } from '@/copy';

export const MAX_MESSAGE = 500;

export interface MessageCheck {
  ok: boolean;
  /** Why it can't be sent yet (null when it can). */
  reason: string | null;
  body: string;
}

/** Trims the text and says whether it can be sent. Mirrors the database check (1 to 500 characters). */
export function checkMessage(text: string): MessageCheck {
  const body = text.trim();
  if (body.length === 0) return { ok: false, reason: copy.chat.reasonEmpty, body };
  if (body.length > MAX_MESSAGE) return { ok: false, reason: copy.chat.reasonLong(MAX_MESSAGE), body };
  return { ok: true, reason: null, body };
}

/** How many messages from other people arrived after `seenAt` (an ISO time, or null for never). */
export function countUnread(messages: { senderMemberId: string; createdAt: string }[], myMemberId: string, seenAt: string | null): number {
  return messages.filter((m) => m.senderMemberId !== myMemberId && (seenAt === null || m.createdAt > seenAt)).length;
}
