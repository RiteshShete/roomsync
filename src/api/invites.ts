import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export interface Invite {
  id: string;
  codeHint: string;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
}

/** Invites for a household (owner/admin only; RLS returns nothing to plain members). Newest first. */
export async function listInvites(householdId: string): Promise<Invite[]> {
  const { data, error } = await getSupabase()
    .from('invitations')
    .select('id, code_hint, expires_at, max_uses, use_count, status, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw toAppError(error);
  return data.map((r) => ({
    id: r.id,
    codeHint: r.code_hint,
    expiresAt: r.expires_at,
    maxUses: r.max_uses,
    useCount: r.use_count,
    status: r.status as Invite['status'],
    createdAt: r.created_at,
  }));
}

export interface CreatedInvite {
  inviteId: string;
  /** The only time the plaintext code exists on the client. */
  code: string;
  expiresAt: string;
}

export async function createInvite(householdId: string, options: { expiresInHours?: number; maxUses?: number | null } = {}): Promise<CreatedInvite> {
  const { data, error } = await getSupabase().rpc('create_invite', {
    p_household_id: householdId,
    p_expires_in_hours: options.expiresInHours,
    p_max_uses: options.maxUses ?? undefined,
  });
  if (error) throw toAppError(error);
  const r = data as { invite_id: string; code: string; expires_at: string };
  return { inviteId: r.invite_id, code: r.code, expiresAt: r.expires_at };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_invite', { p_invite_id: inviteId });
  if (error) throw toAppError(error);
}

export interface InvitePreview {
  householdName: string;
  memberCount: number;
  expiresAt: string;
}

type PreviewResult =
  | { ok: true; household_name: string; member_count: number; expires_at: string }
  | { ok: false; error: string };

/**
 * The database returns invalid codes as `{ok:false, error}` (so failed attempts persist for the
 * throttle). Here they become thrown `invalid_invite:<reason>` errors like every other failure.
 */
export async function previewInvite(code: string): Promise<InvitePreview> {
  const { data, error } = await getSupabase().rpc('preview_invite', { p_code: code });
  if (error) throw toAppError(error);
  const r = data as PreviewResult;
  if (!r.ok) throw toAppError({ message: r.error });
  return { householdName: r.household_name, memberCount: r.member_count, expiresAt: r.expires_at };
}

export async function joinHousehold(code: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('join_household', { p_code: code });
  if (error) throw toAppError(error);
  const r = data as { ok: true; household_id: string } | { ok: false; error: string };
  if (!r.ok) throw toAppError({ message: r.error });
  return r.household_id;
}
