import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChore, listChores } from '@/api/chores';

export function useChores(householdId: string | undefined) {
  return useQuery({ queryKey: ['chores', householdId], queryFn: () => listChores(householdId!), enabled: !!householdId, staleTime: 0 });
}

export function useChore(id: string | undefined) {
  return useQuery({ queryKey: ['chore', id], queryFn: () => getChore(id!), enabled: !!id, staleTime: 0 });
}

export function useInvalidateChores() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: ['chores'] }), client.invalidateQueries({ queryKey: ['chore'] })]);
}
