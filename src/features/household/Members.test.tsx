import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as households from '@/api/households';
import { copy } from '@/copy';
import { aarav, kunal, member, membership, mockApi, renderApp, riya } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

beforeEach(() => {
  vi.resetAllMocks();
  mockApi();
});

const row = (name: string) => screen.getByText(name, { selector: 'p' }).closest('li')!;

describe('members list', () => {
  it('shows every member with avatar, role chip, and which one is you', async () => {
    renderApp('/you/members');
    expect(await screen.findByRole('heading', { level: 1, name: copy.members.title })).toBeInTheDocument();
    expect(await screen.findByText('3 members')).toBeInTheDocument();
    expect(within(row('Aarav')).getByText('Owner')).toBeInTheDocument();
    expect(within(row('Aarav')).getByText(`(${copy.members.you})`)).toBeInTheDocument();
    expect(within(row('Riya')).getByText('Admin')).toBeInTheDocument();
    expect(within(row('Kunal')).getByText('Member')).toBeInTheDocument();
    expect(within(row('Riya')).queryByText(`(${copy.members.you})`)).not.toBeInTheDocument();
    expect(within(row('Riya')).getByRole('img', { name: 'Riya' })).toBeInTheDocument();
  });

  it('marks members who are moving out', async () => {
    mockApi({ members: [aarav, member({ memberId: 'm-x', userId: 'u-x', role: 'member', status: 'leaving', displayName: 'Sneha' })] });
    renderApp('/you/members');
    expect(within(await screen.findByText('Sneha', { selector: 'p' }).then((e) => e.closest('li')!)).getByText(copy.members.movingOut)).toBeInTheDocument();
  });

  it('shows a loading state, then an error with retry', async () => {
    vi.mocked(households.listMembers).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/you/members');
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    vi.mocked(households.listMembers).mockResolvedValue([aarav]);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByText('1 member')).toBeInTheDocument();
  });

  it('shows the loading skeleton while fetching', async () => {
    vi.mocked(households.listMembers).mockReturnValue(new Promise(() => {}));
    renderApp('/you/members');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('has a back button to the You tab', async () => {
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.header.back }));
    expect(await screen.findByText(copy.you.signedInAs)).toBeInTheDocument();
  });
});

describe('who sees management controls (UX only; the database enforces roles)', () => {
  it('the owner can manage everyone except themselves', async () => {
    renderApp('/you/members');
    await screen.findByText('Riya', { selector: 'p' });
    expect(screen.getByRole('button', { name: copy.members.manageFor('Riya') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.members.manageFor('Kunal') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.members.manageFor('Aarav') })).not.toBeInTheDocument();
  });

  it.each(['admin', 'member'] as const)('a %s sees no manage buttons and is told why', async (role) => {
    mockApi({ me: membership({ role, memberId: 'm-riya' }) });
    renderApp('/you/members');
    await screen.findByText('Riya', { selector: 'p' });
    expect(screen.queryByRole('button', { name: /^Manage/ })).not.toBeInTheDocument();
    expect(screen.getByText(copy.members.onlyOwnerManages)).toBeInTheDocument();
  });

  it('in an archived household management is disabled with a reason', async () => {
    mockApi({ me: membership({ archived: true }) });
    renderApp('/you/members');
    const manage = await screen.findByRole('button', { name: copy.members.manageFor('Riya') });
    expect(manage).toHaveAttribute('aria-disabled', 'true');
    expect(manage).toHaveAccessibleDescription(copy.errors.householdArchived);
    await userEvent.click(manage);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('changing roles', () => {
  it('promotes a member to admin', async () => {
    vi.mocked(households.setMemberRole).mockResolvedValue();
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor('Kunal') }));
    expect(screen.getByRole('dialog', { name: copy.members.manageFor('Kunal') })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.members.makeAdmin }));
    expect(households.setMemberRole).toHaveBeenCalledWith('m-kunal', 'admin');
    expect(await screen.findByText(copy.members.roleUpdated('Kunal', 'admin'))).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers to demote an admin back to member', async () => {
    vi.mocked(households.setMemberRole).mockResolvedValue();
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor('Riya') }));
    await userEvent.click(screen.getByRole('button', { name: copy.members.makeMember }));
    expect(households.setMemberRole).toHaveBeenCalledWith('m-riya', 'member');
  });

  it('a failed change is explained and the sheet stays open', async () => {
    vi.mocked(households.setMemberRole).mockRejectedValue({ message: 'permission_denied' });
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor('Kunal') }));
    await userEvent.click(screen.getByRole('button', { name: copy.members.makeAdmin }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.permission);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('transferring ownership', () => {
  async function openTransfer(name: string) {
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor(name) }));
    await userEvent.click(screen.getByRole('button', { name: copy.members.makeOwner }));
  }

  it('explains the consequences first and only then transfers', async () => {
    vi.mocked(households.transferOwnership).mockResolvedValue();
    renderApp('/you/members');
    await openTransfer('Riya');
    const dialog = screen.getByRole('dialog', { name: copy.members.transferTitle });
    expect(dialog).toHaveTextContent('Riya will become the owner. You’ll become an admin.');
    expect(households.transferOwnership).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: copy.members.transferConfirm }));
    expect(households.transferOwnership).toHaveBeenCalledWith('m-riya');
    expect(await screen.findByText(copy.members.transferred('Riya'))).toBeInTheDocument();
  });

  it('cancelling transfers nothing', async () => {
    renderApp('/you/members');
    await openTransfer('Riya');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(households.transferOwnership).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a member who is moving out cannot become the owner', async () => {
    mockApi({ members: [aarav, member({ memberId: 'm-x', userId: 'u-x', role: 'member', status: 'leaving', displayName: 'Sneha' })] });
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor('Sneha') }));
    expect(screen.getByRole('button', { name: copy.members.makeOwner })).toHaveAttribute('aria-disabled', 'true');
  });

  it('a server refusal is shown and nothing changes', async () => {
    vi.mocked(households.transferOwnership).mockRejectedValue({ message: 'permission_denied' });
    renderApp('/you/members');
    await openTransfer('Kunal');
    await userEvent.click(screen.getByRole('button', { name: copy.members.transferConfirm }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.permission);
  });
});

it('keeps unused fixtures honest', () => {
  expect([aarav.role, riya.role, kunal.role]).toEqual(['owner', 'admin', 'member']);
});
