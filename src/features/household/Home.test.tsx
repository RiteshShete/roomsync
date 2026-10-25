import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as households from '@/api/households';
import { copy } from '@/copy';
import { aarav, kunal, membership, mockApi, renderApp, riya } from '@/test/render';
import { formatInviteCode } from '@/domain';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

beforeEach(() => {
  vi.resetAllMocks();
  mockApi();
});

describe('Home skeleton (spec §8.4)', () => {
  it('shows the household, its members, and the "Your house is ready" empty state', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: copy.home.emptyTitle })).toBeInTheDocument();
    expect(screen.getByText(copy.home.emptyBody)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '3 members' })).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
  });

  it('quick-add shortcuts go to real screens', async () => {
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: copy.home.quickAdd });
    expect(within(nav).getByRole('link', { name: copy.home.addExpense })).toHaveAttribute('href', '/expenses/new');
    expect(within(nav).getByRole('link', { name: copy.home.addChore })).toHaveAttribute('href', '/chores/new');
    expect(within(nav).getByRole('link', { name: copy.home.addGrocery })).toHaveAttribute('href', '/house/groceries');
  });

  it('an owner who is alone is nudged to invite roommates, and the link works', async () => {
    mockApi({ members: [aarav] });
    renderApp('/');
    expect(await screen.findByText(copy.home.alone)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: copy.home.inviteCta }));
    expect(await screen.findByRole('heading', { level: 1, name: copy.invites.title })).toBeInTheDocument();
  });

  it('a plain member who is alone sees no invite shortcut', async () => {
    mockApi({ me: membership({ role: 'member' }), members: [kunal] });
    renderApp('/');
    await screen.findByText(copy.home.alone);
    expect(screen.queryByRole('link', { name: copy.home.inviteCta })).not.toBeInTheDocument();
  });

  it('no invite nudge when housemates are already here', async () => {
    mockApi({ members: [aarav, riya] });
    renderApp('/');
    await screen.findByText('2 members');
    expect(screen.queryByText(copy.home.alone)).not.toBeInTheDocument();
  });

  it('shows a loading state, then an error with retry', async () => {
    vi.mocked(households.listMembers).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    vi.mocked(households.listMembers).mockResolvedValue([aarav, riya]);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByText('2 members')).toBeInTheDocument();
  });
});

describe('app shell for an archived household', () => {
  it('shows a banner on every page', async () => {
    mockApi({ me: membership({ archived: true }) });
    renderApp('/');
    expect(await screen.findByText(copy.settings.banner)).toBeInTheDocument();
  });

  it('no banner for an active household', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Flat 4B' });
    expect(screen.queryByText(copy.settings.banner)).not.toBeInTheDocument();
  });
});

describe('You tab', () => {
  it('links to members, invitations and settings', async () => {
    renderApp('/you');
    expect(await screen.findByRole('link', { name: new RegExp(copy.you.members) })).toHaveAttribute('href', '/you/members');
    expect(screen.getByRole('link', { name: new RegExp(copy.you.invites) })).toHaveAttribute('href', '/you/invites');
    expect(screen.getByRole('link', { name: new RegExp(copy.you.settings) })).toHaveAttribute('href', '/you/household');
  });

  it('sub-pages bring their own header rather than doubling the shell header', async () => {
    renderApp('/you/members');
    expect(await screen.findAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('the bottom nav keeps "You" current on sub-pages', async () => {
    renderApp('/you/household');
    await screen.findByRole('heading', { level: 1, name: copy.settings.title });
    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('formatInviteCode', () => {
  it.each([
    ['ABCD2345', 'ABCD-2345'],
    ['abcd-2345', 'ABCD-2345'],
    [' abcd 2345 ', 'ABCD-2345'],
    ['short', 'short'],
  ])('%j -> %j', (input, out) => expect(formatInviteCode(input)).toBe(out));
});
