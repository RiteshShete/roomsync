import { useQuery } from '@tanstack/react-query';
import { getMyMembership } from '@/api/households';
import { getMyProfile } from '@/api/profile';
import { useSession } from '@/features/auth/Session';

/** The signed-in user's current household membership (null when they have none yet). */
export function useMembership() {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.id : null;
  return useQuery({
    queryKey: ['membership', uid],
    queryFn: () => getMyMembership(uid!),
    enabled: uid !== null,
  });
}

export function useProfile() {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.id : null;
  return useQuery({
    queryKey: ['profile', uid],
    queryFn: () => getMyProfile(uid!),
    enabled: uid !== null,
  });
}
