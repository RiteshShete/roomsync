import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMoveOut, listMoveOutNotes } from '@/api/households';

export function useMoveOut(memberId: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['move-out', memberId], queryFn: () => getMoveOut(memberId!), enabled: !!memberId && enabled, staleTime: 0 });
}

export function useMoveOutNotes(memberId: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['move-out-notes', memberId], queryFn: () => listMoveOutNotes(memberId!), enabled: !!memberId && enabled, staleTime: 0 });
}

/**
 * Starting, cancelling or finishing a move-out changes who is in the household, which chores are
 * assigned to whom, and what screens may show, so refresh everything that depends on it.
 */
export function useInvalidateMembership() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}
