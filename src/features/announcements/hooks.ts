import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listAnnouncements } from '@/api/announcements';

export function useAnnouncements(householdId: string | undefined) {
  return useQuery({ queryKey: ['announcements', householdId], queryFn: () => listAnnouncements(householdId!), enabled: !!householdId, staleTime: 0 });
}

export function useInvalidateAnnouncements() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['announcements'] });
}
