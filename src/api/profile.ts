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
