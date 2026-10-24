import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listGroceries } from '@/api/groceries';

export function useGroceries(householdId: string | undefined) {
  return useQuery({ queryKey: ['groceries', householdId], queryFn: () => listGroceries(householdId!), enabled: !!householdId, staleTime: 0 });
}

export function useInvalidateGroceries() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['groceries'] });
}
