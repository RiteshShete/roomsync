import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export type Role = 'owner' | 'admin' | 'member';
export type DefaultSplit = 'equal' | 'custom' | 'percentage';

export interface Membership {
  memberId: string;
  role: Role;
  status: 'active' | 'leaving';
  household: { id: string; name: string; currencyCode: string; status: 'active' | 'archived' };
}

/** The caller's current (non-left) membership with its household, or null when they have none. */
export async function getMyMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await getSupabase()
    .from('household_members')
    .select('id, role, status, households(id, name, currency_code, status)')
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

export async function setMemberRole(memberId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await getSupabase().rpc('set_member_role', { p_member_id: memberId, p_role: role });
  if (error) throw toAppError(error);
}

export async function transferOwnership(memberId: string): Promise<void> {
  const { error } = await getSupabase().rpc('transfer_ownership', { p_member_id: memberId });
  if (error) throw toAppError(error);
}
