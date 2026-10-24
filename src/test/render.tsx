import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import * as households from '@/api/households';
import * as invites from '@/api/invites';
import * as profile from '@/api/profile';
import { AppRoutes } from '@/App';
import { SessionContext, type SessionState } from '@/features/auth/Session';
import { ToastProvider } from '@/ui';

/** Test data. Tests mock the `api/` modules (Supabase never runs in unit tests). */
export const signedIn = { status: 'signedIn', user: { id: 'u-aarav', email: 'aarav@example.com' }, recovery: false } as unknown as SessionState;

export function membership(overrides: Partial<households.Membership> & { archived?: boolean } = {}): households.Membership {
  const { archived, household, ...rest } = overrides;
  return {
    memberId: 'm-aarav',
    role: 'owner',
    status: 'active',
    household: { id: 'h1', name: 'Flat 4B', currencyCode: 'INR', status: archived ? 'archived' : 'active', ...household },
    ...rest,
  };
}

export function member(overrides: Partial<households.Member> = {}): households.Member {
  return {
    memberId: 'm-aarav',
    userId: 'u-aarav',
    role: 'owner',
    status: 'active',
    displayName: 'Aarav',
    avatarColor: '#4F46E5',
    joinedAt: '2026-01-01T00:00:00Z',
    moveOutEffectiveDate: null,
    ...overrides,
  };
}

export const aarav = member();
export const riya = member({ memberId: 'm-riya', userId: 'u-riya', role: 'admin', displayName: 'Riya', avatarColor: '#15803D' });
export const kunal = member({ memberId: 'm-kunal', userId: 'u-kunal', role: 'member', displayName: 'Kunal', avatarColor: '#B45309' });

export function household(overrides: Partial<households.HouseholdDetails> = {}): households.HouseholdDetails {
  return {
    id: 'h1',
    name: 'Flat 4B',
    currencyCode: 'INR',
    defaultSplit: 'equal',
    choreRemindersEnabled: true,
    status: 'active',
    version: 3,
    ...overrides,
  };
}

export function invite(overrides: Partial<invites.Invite> = {}): invites.Invite {
  return {
    id: 'i1',
    codeHint: 'AB',
    expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    maxUses: null,
    useCount: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Sensible defaults for every mocked API call; individual tests override what they care about. */
export function mockApi({ me = membership(), members = [aarav, riya, kunal] }: { me?: households.Membership | null; members?: households.Member[] } = {}) {
  vi.mocked(profile.getMyProfile).mockResolvedValue({ displayName: 'Aarav', avatarColor: '#4F46E5' });
  vi.mocked(households.getMyMembership).mockResolvedValue(me);
  vi.mocked(households.listMembers).mockResolvedValue(members);
  vi.mocked(households.getHousehold).mockResolvedValue(household());
  vi.mocked(households.householdHasMoney).mockResolvedValue(false);
  vi.mocked(invites.listInvites).mockResolvedValue([]);
}

/** Renders the whole route table, as a real user would experience it. */
export function renderApp(path: string | { pathname: string; state?: unknown }, session: SessionState = signedIn) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionContext.Provider value={session}>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </SessionContext.Provider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, client };
}
