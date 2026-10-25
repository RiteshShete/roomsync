import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export type Role = 'owner' | 'admin' | 'member';
export type DefaultSplit = 'equal' | 'custom' | 'percentage';

export interface Membership {
  memberId: string;
  role: Role;
  status: 'active' | 'leaving';
  /** Set while status is `leaving`: the day the move-out takes effect. */
  moveOutEffectiveDate: string | null;
  household: { id: string; name: string; currencyCode: string; status: 'active' | 'archived' };
}

/** The caller's current (non-left) membership with its household, or null when they have none. */
export async function getMyMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await getSupabase()
    .from('household_members')
    .select('id, role, status, move_out_effective_date, households(id, name, currency_code, status)')
    .eq('user_id', userId)
    .neq('status', 'left')
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  const h = Array.isArray(data.households) ? data.households[0] : data.households;
  if (!h) return null;
  return {
    memberId: data.id,
    role: data.role as Role,
    status: data.status as Membership['status'],
    moveOutEffectiveDate: data.move_out_effective_date,
    household: { id: h.id, name: h.name, currencyCode: h.currency_code, status: h.status as 'active' | 'archived' },
  };
}

export interface HouseholdDetails {
  id: string;
  name: string;
  currencyCode: string;
  defaultSplit: DefaultSplit;
  choreRemindersEnabled: boolean;
  status: 'active' | 'archived';
  version: number;
}

export async function getHousehold(householdId: string): Promise<HouseholdDetails> {
  const { data, error } = await getSupabase()
    .from('households')
    .select('id, name, currency_code, default_split, chore_reminders_enabled, status, version')
    .eq('id', householdId)
    .single();
  if (error) throw toAppError(error);
  return {
    id: data.id,
    name: data.name,
    currencyCode: data.currency_code,
    defaultSplit: data.default_split as DefaultSplit,
    choreRemindersEnabled: data.chore_reminders_enabled,
    status: data.status as 'active' | 'archived',
    version: data.version,
  };
}

/** True once any expense or settlement exists (the currency is then locked). */
export async function householdHasMoney(householdId: string): Promise<boolean> {
  const supabase = getSupabase();
  const [expenses, settlements] = await Promise.all([
    supabase.from('expenses').select('id', { head: true, count: 'exact' }).eq('household_id', householdId).limit(1),
    supabase.from('settlements').select('id', { head: true, count: 'exact' }).eq('household_id', householdId).limit(1),
  ]);
  if (expenses.error) throw toAppError(expenses.error);
  if (settlements.error) throw toAppError(settlements.error);
  return (expenses.count ?? 0) > 0 || (settlements.count ?? 0) > 0;
}

export async function createHousehold(input: {
  name: string;
  currencyCode?: string;
  defaultSplit?: DefaultSplit;
  choreReminders?: boolean;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_household', {
    p_name: input.name,
    p_currency_code: input.currencyCode,
    p_default_split: input.defaultSplit,
    p_chore_reminders: input.choreReminders,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function updateHousehold(
  householdId: string,
  expectedVersion: number,
  patch: { name?: string; currencyCode?: string; defaultSplit?: DefaultSplit; choreRemindersEnabled?: boolean },
): Promise<number> {
  const { data, error } = await getSupabase().rpc('update_household', {
    p_household_id: householdId,
    p_expected_version: expectedVersion,
    p_name: patch.name,
    p_currency_code: patch.currencyCode,
    p_default_split: patch.defaultSplit,
    p_chore_reminders: patch.choreRemindersEnabled,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function setHouseholdArchived(householdId: string, archived: boolean, expectedVersion?: number): Promise<number> {
  const { data, error } = await getSupabase().rpc('set_household_archived', {
    p_household_id: householdId,
    p_archived: archived,
    p_expected_version: expectedVersion,
  });
  if (error) throw toAppError(error);
  return data;
}

export interface Member {
  memberId: string;
  userId: string;
  role: Role;
  status: 'active' | 'leaving';
  displayName: string;
  avatarColor: string;
  joinedAt: string;
  moveOutEffectiveDate: string | null;
}

/** Current (non-left) members with their profile names, oldest first. */
export async function listMembers(householdId: string): Promise<Member[]> {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('household_members')
    .select('id, user_id, role, status, joined_at, move_out_effective_date')
    .eq('household_id', householdId)
    .neq('status', 'left')
    .order('joined_at', { ascending: true });
  if (error) throw toAppError(error);
  const ids = rows.map((r) => r.user_id);
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, display_name, avatar_color').in('id', ids);
  if (pErr) throw toAppError(pErr);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({
    memberId: r.id,
    userId: r.user_id,
    role: r.role as Role,
    status: r.status as Member['status'],
    displayName: byId.get(r.user_id)?.display_name ?? 'Member',
    avatarColor: byId.get(r.user_id)?.avatar_color ?? '#4F46E5',
    joinedAt: r.joined_at,
    moveOutEffectiveDate: r.move_out_effective_date,
  }));
}

export type MemberWithLeft = Omit<Member, 'status'> & { status: 'active' | 'leaving' | 'left' };

/**
 * Every member the household has ever had, including people who left. Needed to show names on
 * history (expenses, settlements) that involve someone who has since moved out.
 */
export async function listAllMembers(householdId: string): Promise<MemberWithLeft[]> {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('household_members')
    .select('id, user_id, role, status, joined_at, move_out_effective_date')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) throw toAppError(error);
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, display_name, avatar_color').in('id', ids);
  if (pErr) throw toAppError(pErr);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({
    memberId: r.id,
    userId: r.user_id,
    role: r.role as Role,
    status: r.status as MemberWithLeft['status'],
    displayName: byId.get(r.user_id)?.display_name ?? 'Former member',
    avatarColor: byId.get(r.user_id)?.avatar_color ?? '#6b5f57',
    joinedAt: r.joined_at,
    moveOutEffectiveDate: r.move_out_effective_date,
  }));
}

export async function setMemberRole(memberId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await getSupabase().rpc('set_member_role', { p_member_id: memberId, p_role: role });
  if (error) throw toAppError(error);
}

export async function transferOwnership(memberId: string): Promise<void> {
  const { error } = await getSupabase().rpc('transfer_ownership', { p_member_id: memberId });
  if (error) throw toAppError(error);
}

/** Moves to the "leaving" state. The caller is the member themselves, an owner, or (for non-owners) an admin. */
export async function startMoveOut(input: { memberId: string; effectiveDate: string; note: string | null; acknowledgedBalanceMinor: number | null }): Promise<void> {
  const { error } = await getSupabase().rpc('start_move_out', {
    p_member_id: input.memberId,
    p_effective_date: input.effectiveDate,
    p_note: input.note ?? undefined,
    p_acknowledged_balance_minor: input.acknowledgedBalanceMinor ?? undefined,
  });
  if (error) throw toAppError(error);
}

export async function cancelMoveOut(memberId: string): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_move_out', { p_member_id: memberId });
  if (error) throw toAppError(error);
}

/** A note or dispute from the person moving out. Never resolved automatically. */
export async function addMoveOutNote(memberId: string, note: string): Promise<void> {
  const { error } = await getSupabase().rpc('add_move_out_dispute', { p_member_id: memberId, p_note: note });
  if (error) throw toAppError(error);
}

export interface MoveOutNote {
  id: string;
  note: string;
  createdAt: string;
}

export async function listMoveOutNotes(memberId: string): Promise<MoveOutNote[]> {
  const { data, error } = await getSupabase().from('member_move_out_disputes').select('id, note, created_at').eq('member_id', memberId).order('created_at', { ascending: true }).limit(100);
  if (error) throw toAppError(error);
  return data.map((r) => ({ id: r.id, note: r.note, createdAt: r.created_at }));
}

export interface MyMoveOut {
  effectiveDate: string | null;
  requestedAt: string | null;
  requestedByMemberId: string | null;
  note: string | null;
  acknowledgedBalanceMinor: number | null;
}

/** What was recorded when this member's move-out was started. */
export async function getMoveOut(memberId: string): Promise<MyMoveOut> {
  const { data, error } = await getSupabase()
    .from('household_members')
    .select('move_out_effective_date, move_out_requested_at, move_out_requested_by, move_out_note, move_out_acknowledged_balance_minor')
    .eq('id', memberId)
    .single();
  if (error) throw toAppError(error);
  return {
    effectiveDate: data.move_out_effective_date,
    requestedAt: data.move_out_requested_at,
    requestedByMemberId: data.move_out_requested_by,
    note: data.move_out_note,
    acknowledgedBalanceMinor: data.move_out_acknowledged_balance_minor === null ? null : Number(data.move_out_acknowledged_balance_minor),
  };
}

/** Applies any move-outs whose date has passed. Returns how many people flipped to "left". */
export async function reconcileHousehold(householdId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('reconcile_household', { p_household_id: householdId });
  if (error) throw toAppError(error);
  return data;
}

export interface LeftHousehold {
  householdId: string;
  name: string;
  leftAt: string;
}

/** Households the caller has left, newest first: just a name and a date (they have no other access). */
export async function listMyLeftHouseholds(): Promise<LeftHousehold[]> {
  const { data, error } = await getSupabase().rpc('my_left_households');
  if (error) throw toAppError(error);
  return data.map((r) => ({ householdId: r.household_id, name: r.name, leftAt: r.left_at }));
}
