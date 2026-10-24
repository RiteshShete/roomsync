/** Invite code rules (PLAN D7). Codes are generated and SHA-256 hashed in the database; the client only normalises and checks format. */

export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 8;

/** Uppercase and strip spaces/dashes so pasted codes like "abcd-2345" match. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** Readable grouping for display: "ABCD2345" -> "ABCD-2345". Anything else is returned unchanged. */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code);
  return c.length === INVITE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : code;
}

export function isValidInviteFormat(input: string): boolean {
  const code = normalizeInviteCode(input);
  return code.length === INVITE_LENGTH && [...code].every((c) => INVITE_ALPHABET.includes(c));
}

export type InviteState = 'ok' | 'revoked' | 'expired' | 'used_up';

export function inviteState(
  invite: { status: 'active' | 'revoked' | 'expired'; expiresAt: string; maxUses: number | null; useCount: number },
  nowIso: string,
): InviteState {
  if (invite.status === 'revoked') return 'revoked';
  if (invite.status === 'expired' || invite.expiresAt <= nowIso) return 'expired';
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return 'used_up';
  return 'ok';
}
