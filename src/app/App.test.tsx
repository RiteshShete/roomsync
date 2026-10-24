import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as households from '@/api/households';
import * as profile from '@/api/profile';
import * as auth from '@/api/auth';
import { AppRoutes } from '@/App';
import { SessionContext, type SessionState } from '@/features/auth/Session';
import { copy } from '@/copy';
import { ToastProvider } from '@/ui';
import { ErrorBoundary } from './ErrorBoundary';
import { OfflineBanner } from './OfflineBanner';

vi.mock('@/api/households');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

const signedIn = { status: 'signedIn', user: { id: 'u1', email: 'aarav@example.com' }, recovery: false } as unknown as SessionState;

function renderApp(path: string, session: SessionState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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
}

const membership = {
  memberId: 'm1',
  role: 'owner' as const,
  status: 'active' as const,
  household: { id: 'h1', name: 'Flat 4B', currencyCode: 'INR', status: 'active' as const },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(profile.getMyProfile).mockResolvedValue({ displayName: 'Aarav', avatarColor: '#4F46E5' });
});

describe('routing and guards', () => {
  it('logged-out visitors land on the welcome screen', async () => {
    renderApp('/', { status: 'signedOut' });
    expect(await screen.findByRole('heading', { name: 'Shared living, simplified.' })).toBeInTheDocument();
  });

  it('shows a loading state while the session resolves', () => {
    renderApp('/', { status: 'loading' });
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('a signed-in user is kept off the log-in screen', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    renderApp('/login', signedIn);
    expect(await screen.findByText(copy.household.chooseBody)).toBeInTheDocument();
  });

  it('a user with no household is sent to the set-up screen with honest, disabled choices', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    renderApp('/', signedIn);
    expect(await screen.findByRole('heading', { name: 'Hi, Aarav' })).toBeInTheDocument();
    const create = screen.getByRole('button', { name: new RegExp(copy.household.create) });
    expect(create).toHaveAttribute('aria-disabled', 'true');
    expect(create).toHaveAccessibleDescription(copy.household.notYet);
    expect(screen.getAllByText(copy.household.notYet)).toHaveLength(2);
  });

  it('a user with a household sees the shell with the household name and five tabs', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(membership);
    renderApp('/', signedIn);
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.querySelectorAll('a')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(copy.placeholder.body)).toBeInTheDocument();
  });

  it('navigates between tabs and updates the heading', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(membership);
    renderApp('/', signedIn);
    await screen.findByRole('heading', { name: 'Flat 4B' });
    await userEvent.click(screen.getByRole('link', { name: 'Expenses' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Expenses' })).toHaveAttribute('aria-current', 'page');
  });

  it('a user who already has a household cannot open the set-up screen', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(membership);
    renderApp('/start', signedIn);
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
  });

  it('a failed membership load shows an error with retry', async () => {
    vi.mocked(households.getMyMembership).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/', signedIn);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    vi.mocked(households.getMyMembership).mockResolvedValue(membership);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
  });

  it('the You tab shows the account and signs out', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(membership);
    vi.mocked(auth.signOut).mockResolvedValue();
    renderApp('/you', signedIn);
    expect(await screen.findByText('aarav@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.auth.signOut }));
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('a failed sign-out tells the user instead of failing silently', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(membership);
    vi.mocked(auth.signOut).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/you', signedIn);
    await userEvent.click(await screen.findByRole('button', { name: copy.auth.signOut }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
  });

  it('the reset-password screen is reachable while logged out and says when the link is dead', async () => {
    renderApp('/reset-password', { status: 'signedOut' });
    expect((await screen.findAllByText(copy.auth.resetInvalidTitle)).length).toBeGreaterThan(0);
  });

  it('unknown paths fall back to the app root', async () => {
    renderApp('/nope', { status: 'signedOut' });
    expect(await screen.findByRole('heading', { name: 'Shared living, simplified.' })).toBeInTheDocument();
  });
});

describe('OfflineBanner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is hidden while online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('appears when the browser goes offline and disappears when it returns, without promising sync', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get');
    online.mockReturnValue(true);
    render(<OfflineBanner />);
    online.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent(copy.offline);
    expect(copy.offline).not.toMatch(/sync/i);
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  function Boom(): never {
    throw new Error('render exploded');
  }

  it('replaces a crashed tree with a readable message and a reload button', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors.generic);
    expect(screen.getByRole('button', { name: copy.states.reload })).toBeInTheDocument();
    expect(screen.queryByText(/render exploded/)).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders children normally when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });
});
