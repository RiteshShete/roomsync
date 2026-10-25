import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAllMembers, type MemberWithLeft } from '@/api/households';

/** Every member including people who have left, so names still show on old history. */
export function useAllMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: ['members-all', householdId],
    queryFn: () => listAllMembers(householdId!),
    enabled: !!householdId,
    staleTime: 0,
  });
}

/** Name lookup by member id or user id, tolerant of people who have left. */
export function useDirectory(householdId: string | undefined) {
  const members = useAllMembers(householdId);
  const list: MemberWithLeft[] = members.data ?? [];
  const byMember = new Map(list.map((m) => [m.memberId, m]));
  const byUser = new Map(list.map((m) => [m.userId, m]));
  return {
    isPending: members.isPending,
    isFetching: members.isFetching,
    isError: members.isError,
    error: members.error,
    refetch: members.refetch,
    members: list,
    nameOf: (memberId: string | null | undefined) => (memberId ? (byMember.get(memberId)?.displayName ?? 'Former member') : 'Someone'),
    nameOfUser: (userId: string | null | undefined) => (userId ? (byUser.get(userId)?.displayName ?? 'Former member') : 'Someone'),
    member: (memberId: string) => byMember.get(memberId),
  };
}

/**
 * For forms that copy the member list into their own state when they open. Cached members may be
 * out of date (someone joined while this device sat on another screen), so wait for one fresh fetch,
 * then stay ready: a later background refresh must never remount a form and lose what was typed.
 */
export function useFreshDirectory(householdId: string | undefined) {
  const dir = useDirectory(householdId);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!dir.isPending && !dir.isFetching) setReady(true);
  }, [dir.isPending, dir.isFetching]);
  return { ...dir, isPending: dir.isPending || !ready };
}
