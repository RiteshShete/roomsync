import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  senderMemberId: string;
  body: string;
  createdAt: string;
}

/** How many of the newest messages the app loads. The database keeps only a short window anyway. */
export const CHAT_PAGE = 100;

interface Row {
  id: string;
  sender_member_id: string;
  body: string;
  created_at: string;
}

/** The newest messages, oldest first (the order they are read in). */
export async function listMessages(householdId: string): Promise<ChatMessage[]> {
  const { data, error } = await getSupabase()
    .from('chat_messages')
    .select('id, sender_member_id, body, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(CHAT_PAGE);
  if (error) throw toAppError(error);
  return (data as Row[]).reverse().map((r) => ({ id: r.id, senderMemberId: r.sender_member_id, body: r.body, createdAt: r.created_at }));
}

export async function sendMessage(householdId: string, senderMemberId: string, body: string): Promise<void> {
  const { error } = await getSupabase().from('chat_messages').insert({ household_id: householdId, sender_member_id: senderMemberId, body });
  if (error) throw toAppError(error);
}
