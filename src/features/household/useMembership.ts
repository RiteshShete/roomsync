import { useQuery } from '@tanstack/react-query';
import { getHousehold, getMyMembership, householdHasMoney, listMembers, type Role } from '@/api/households';
import { listInvites } from '@/api/invites';
import { getMyProfile } from '@/api/profile';
import { copy } from '@/copy';
import { useSession } from '@/features/auth/Session';

function useUserId(): string | null {
  const session = useSession();
  return session.status === 'signedIn' ? session.user.id : null;
}

/** The signed-in user's current household membership (null when they have none yet). */
export function useMembership() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['membership', uid],
    queryFn: () => getMyMembership(uid!),
    enabled: uid !== null,
  });
}

export function useProfile() {
  const uid = useUserId();
  return useQuery({
    queryKey: ['profile', uid],
    queryFn: () => getMyProfile(uid!),
    enabled: uid !== null,
  });
}

export function useHousehold(householdId: string | undefined) {
  return useQuery({
    queryKey: ['household', householdId],
    queryFn: () => getHousehold(householdId!),
    enabled: !!householdId,
    staleTime: 0, // other people change this: always refetch when a screen opens
  });
}

export function useHouseholdHasMoney(householdId: string | undefined) {
  return useQuery({
    queryKey: ['household-has-money', householdId],
    queryFn: () => householdHasMoney(householdId!),
    enabled: !!householdId,
    staleTime: 0,
  });
}

export function useMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: ['members', householdId],
    queryFn: () => listMembers(householdId!),
    enabled: !!householdId,
    staleTime: 0,
  });
}

export function useInvites(householdId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['invites', householdId],
    queryFn: () => listInvites(householdId!),
    enabled: !!householdId && enabled,
    staleTime: 0,
  });
}

export interface HouseholdAccess {
  role: Role;
  memberId: string;
  householdId: string;
  householdName: string;
  currencyCode: string;
  isOwner: boolean;
  /** Owner or admin. UX only: the database enforces this. */
  isAdmin: boolean;
  archived: boolean;
  /** Set when write controls must be disabled; show it next to the control. */
  writeBlockedReason: string | null;
}

/** Role and archive state of the current user's household, derived from their membership. */
export function useHouseholdAccess(): HouseholdAccess | null {
  const { data } = useMembership();
  if (!data) return null;
  const archived = data.household.status === 'archived';
  return {
    role: data.role,
    memberId: data.memberId,
    householdId: data.household.id,
    householdName: data.household.name,
    currencyCode: data.household.currencyCode,
    isOwner: data.role === 'owner',
    isAdmin: data.role === 'owner' || data.role === 'admin',
    archived,
    writeBlockedReason: archived ? copy.errors.householdArchived : null,
  };
}
