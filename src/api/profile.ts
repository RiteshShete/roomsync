import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export interface Profile {
  displayName: string;
  avatarColor: string;
}

export async function getMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('display_name, avatar_color')
    .eq('id', userId)
    .single();
  if (error) throw toAppError(error);
  return { displayName: data.display_name, avatarColor: data.avatar_color };
}

export async function updateMyProfile(userId: string, input: Profile): Promise<void> {
  const { error } = await getSupabase().from('profiles').update({ display_name: input.displayName, avatar_color: input.avatarColor }).eq('id', userId);
  if (error) throw toAppError(error);
}

/** Everything the caller can see in their household, as JSON (RPC `export_my_household_data`). */
export async function exportMyHouseholdData(householdId: string): Promise<unknown> {
  const { data, error } = await getSupabase().rpc('export_my_household_data', { p_household_id: householdId });
  if (error) throw toAppError(error);
  return data;
}
