import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export interface Membership {
  memberId: string;
  role: 'owner' | 'admin' | 'member';
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
    role: data.role as Membership['role'],
    status: data.status as Membership['status'],
    household: { id: h.id, name: h.name, currencyCode: h.currency_code, status: h.status as 'active' | 'archived' },
  };
}
