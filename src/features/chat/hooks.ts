import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listMessages } from '@/api/chat';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { countUnread } from './messageModel';

const CHAT = 'chat';

export function useMessages(householdId: string | undefined) {
  return useQuery({ queryKey: [CHAT, householdId], queryFn: () => listMessages(householdId!), enabled: !!householdId, staleTime: 0 });
}

export function useInvalidateChat() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [CHAT] });
}

const seenKey = (householdId: string) => `roomsync:chat-seen:${householdId}`;

function readSeen(householdId: string): string | null {
  try {
    return window.localStorage.getItem(seenKey(householdId));
  } catch {
    return null;
  }
}

/**
 * Whether there are messages from others that this device has not looked at. "Seen" is a time kept in this
 * browser only, so nothing extra is stored in the database. Call `markSeen` while the chat is open.
 */
export function useChatUnread() {
  const access = useHouseholdAccess();
  const messages = useMessages(access?.householdId);
  const [seenAt, setSeenAt] = useState<string | null>(() => (access ? readSeen(access.householdId) : null));

  const markSeen = useCallback(() => {
    if (!access) return;
    const now = new Date().toISOString();
    setSeenAt(now);
    try {
      window.localStorage.setItem(seenKey(access.householdId), now);
    } catch {
      // private mode: the dot simply comes back next visit
    }
  }, [access]);

  useEffect(() => {
    if (access) setSeenAt(readSeen(access.householdId));
  }, [access]);

  const unread = useMemo(() => (access && messages.data ? countUnread(messages.data, access.memberId, seenAt) : 0), [access, messages.data, seenAt]);
  return { unread, markSeen };
}
