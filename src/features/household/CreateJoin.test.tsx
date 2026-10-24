import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as households from '@/api/households';
import * as invites from '@/api/invites';
import { copy } from '@/copy';
import * as clipboard from '@/lib/clipboard';
import { membership, mockApi, renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/lib/clipboard');

beforeEach(() => {
  vi.resetAllMocks();
  mockApi({ me: null });
  vi.mocked(clipboard.copyText).mockResolvedValue(true);
});

describe('create household (Journey A)', () => {
  it('asks only for a name up front; optional settings are tucked away and skippable', async () => {
    renderApp('/start/create');
    expect(await screen.findByLabelText(copy.create.name)).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: copy.create.moreOptions });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('more-options')).toHaveAttribute('hidden');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: copy.create.lessOptions })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(copy.create.currency)).toBeVisible();
  });

  it('rejects an empty name without calling the API', async () => {
    renderApp('/start/create');
    await userEvent.click(await screen.findByRole('button', { name: copy.create.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.create.nameRequired);
    expect(households.createHousehold).not.toHaveBeenCalled();
  });

  it('creates with defaults, then offers to invite roommates', async () => {
    vi.mocked(households.createHousehold).mockResolvedValue('h-new');
    renderApp('/start/create');
    await userEvent.type(await screen.findByLabelText(copy.create.name), '  Flat 4B ');
    await userEvent.click(screen.getByRole('button', { name: copy.create.submit }));
    expect(households.createHousehold).toHaveBeenCalledWith({ name: 'Flat 4B', currencyCode: 'INR', defaultSplit: 'equal', choreReminders: true });
    expect(await screen.findByRole('heading', { name: copy.create.inviteTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.create.skip })).toBeInTheDocument();
  });

  it('passes the optional settings through', async () => {
    vi.mocked(households.createHousehold).mockResolvedValue('h-new');
    renderApp('/start/create');
    await userEvent.type(await screen.findByLabelText(copy.create.name), 'Studio');
    await userEvent.click(screen.getByRole('button', { name: copy.create.moreOptions }));
    await userEvent.selectOptions(screen.getByLabelText(copy.create.currency), 'USD');
    await userEvent.selectOptions(screen.getByLabelText(copy.create.defaultSplit), 'percentage');
    await userEvent.click(screen.getByRole('switch', { name: copy.create.choreReminders }));
    await userEvent.click(screen.getByRole('button', { name: copy.create.submit }));
    expect(households.createHousehold).toHaveBeenCalledWith({ name: 'Studio', currencyCode: 'USD', defaultSplit: 'percentage', choreReminders: false });
  });

  it('a failed create keeps everything typed and says why (rule 6)', async () => {
    vi.mocked(households.createHousehold).mockRejectedValue({ message: 'already_member' });
    renderApp('/start/create');
    await userEvent.type(await screen.findByLabelText(copy.create.name), 'Flat 4B');
    await userEvent.click(screen.getByRole('button', { name: copy.create.moreOptions }));
    await userEvent.selectOptions(screen.getByLabelText(copy.create.currency), 'EUR');
    await userEvent.click(screen.getByRole('button', { name: copy.create.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.alreadyMember);
    expect(screen.getByLabelText(copy.create.name)).toHaveValue('Flat 4B');
    expect(screen.getByLabelText(copy.create.currency)).toHaveValue('EUR');
    expect(screen.getByRole('button', { name: copy.create.submit })).not.toHaveAttribute('aria-busy');
  });

  it('shows the invite code once, pending, with a working copy button', async () => {
    vi.mocked(households.createHousehold).mockResolvedValue('h-new');
    vi.mocked(invites.createInvite).mockResolvedValue({ inviteId: 'i1', code: 'ABCD2345', expiresAt: '2030-01-01T10:00:00Z' });
    renderApp('/start/create');
    await userEvent.type(await screen.findByLabelText(copy.create.name), 'Flat 4B');
    await userEvent.click(screen.getByRole('button', { name: copy.create.submit }));
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.create }));
    expect(invites.createInvite).toHaveBeenCalledWith('h-new');
    expect(await screen.findByTestId('invite-code')).toHaveTextContent('ABCD-2345');
    expect(screen.getByText(copy.invites.codeNote)).toBeInTheDocument();
    expect(screen.getByText(copy.invites.pendingState)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.invites.copy }));
    expect(clipboard.copyText).toHaveBeenCalledWith('ABCD-2345');
    expect(await screen.findByText(copy.invites.copied)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.create.done })).toBeInTheDocument();
  });

  it('a clipboard failure says so and the code stays on screen', async () => {
    vi.mocked(clipboard.copyText).mockResolvedValue(false);
    vi.mocked(households.createHousehold).mockResolvedValue('h-new');
    vi.mocked(invites.createInvite).mockResolvedValue({ inviteId: 'i1', code: 'ABCD2345', expiresAt: '2030-01-01T10:00:00Z' });
    renderApp('/start/create');
    await userEvent.type(await screen.findByLabelText(copy.create.name), 'Flat 4B');
    await userEvent.click(screen.getByRole('button', { name: copy.create.submit }));
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.create }));
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.copy }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.invites.copyFailed);
    expect(screen.getByTestId('invite-code')).toHaveTextContent('ABCD-2345');
  });

  it('an invite failure is explained and the user can still skip', async () => {
    vi.mocked(households.createHousehold).mockResolvedValue('h-new');
    vi.mocked(invites.createInvite).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/start/create');
    await userEvent.type(await screen.findByLabelText(copy.create.name), 'Flat 4B');
    await userEvent.click(screen.getByRole('button', { name: copy.create.submit }));
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.create }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    expect(screen.getByRole('button', { name: copy.create.skip })).toBeInTheDocument();
  });

  it('skipping the invite step goes straight to the household without waiting for anyone', async () => {
    vi.mocked(households.createHousehold).mockResolvedValue('h-new');
    renderApp('/start/create');
    await userEvent.type(await screen.findByLabelText(copy.create.name), 'Flat 4B');
    vi.mocked(households.getMyMembership).mockResolvedValue(membership());
    vi.mocked(households.listMembers).mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: copy.create.submit }));
    await userEvent.click(await screen.findByRole('button', { name: copy.create.skip }));
    expect(await screen.findByText(copy.home.emptyTitle)).toBeInTheDocument();
  });

  it('someone who already has a household is sent home', async () => {
    mockApi({ me: membership(), members: [] });
    renderApp('/start/create');
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
  });
});

describe('join household (Journey B)', () => {
  const type = async (value: string) => userEvent.type(await screen.findByLabelText(copy.join.code), value);
  const check = () => userEvent.click(screen.getByRole('button', { name: copy.join.check }));

  it('rejects a badly formed code locally with its own message', async () => {
    renderApp('/start/join');
    await type('abc');
    await check();
    expect(screen.getByRole('alert')).toHaveTextContent(copy.join.codeInvalid);
    expect(invites.previewInvite).not.toHaveBeenCalled();
  });

  it('normalises pasted codes and previews only name, member count and expiry', async () => {
    vi.mocked(invites.previewInvite).mockResolvedValue({ householdName: 'Flat 4B', memberCount: 3, expiresAt: '2030-01-01T10:00:00Z' });
    renderApp('/start/join');
    await type(' abcd-2345 ');
    await check();
    expect(invites.previewInvite).toHaveBeenCalledWith('ABCD2345');
    expect(await screen.findByRole('heading', { name: 'Flat 4B' })).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(screen.getByText(copy.join.previewNote)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.join.confirm })).toBeInTheDocument();
  });

  it('singular member count', async () => {
    vi.mocked(invites.previewInvite).mockResolvedValue({ householdName: 'Solo', memberCount: 1, expiresAt: '2030-01-01T10:00:00Z' });
    renderApp('/start/join');
    await type('ABCD2345');
    await check();
    expect(await screen.findByText('1 member')).toBeInTheDocument();
  });

  it.each(['not_found', 'revoked', 'expired', 'used_up', 'household_archived', 'household_full', 'throttled'])(
    'invite state "%s" gets its own message and keeps the code',
    async (reason) => {
      vi.mocked(invites.previewInvite).mockRejectedValue({ message: `invalid_invite:${reason}` });
      renderApp('/start/join');
      await type('ABCD2345');
      await check();
      expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invite[reason]!);
      expect(screen.getByLabelText(copy.join.code)).toHaveValue('ABCD-2345');
      expect(screen.queryByRole('button', { name: copy.join.confirm })).not.toBeInTheDocument();
    },
  );

  it('every invalid-invite message is distinct', () => {
    const messages = Object.values(copy.errors.invite);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('already belonging to a household has its own message', async () => {
    vi.mocked(invites.previewInvite).mockRejectedValue({ message: 'already_member' });
    renderApp('/start/join');
    await type('ABCD2345');
    await check();
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.alreadyMember);
  });

  it('a network failure keeps the code and offers another try', async () => {
    vi.mocked(invites.previewInvite).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/start/join');
    await type('ABCD2345');
    await check();
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    expect(screen.getByLabelText(copy.join.code)).toHaveValue('ABCD-2345');
    vi.mocked(invites.previewInvite).mockResolvedValue({ householdName: 'Flat 4B', memberCount: 2, expiresAt: '2030-01-01T10:00:00Z' });
    await check();
    expect(await screen.findByRole('heading', { name: 'Flat 4B' })).toBeInTheDocument();
  });

  it('confirming joins and lands in the household', async () => {
    vi.mocked(invites.previewInvite).mockResolvedValue({ householdName: 'Flat 4B', memberCount: 2, expiresAt: '2030-01-01T10:00:00Z' });
    vi.mocked(invites.joinHousehold).mockResolvedValue('h1');
    renderApp('/start/join');
    await type('abcd2345');
    await check();
    vi.mocked(households.getMyMembership).mockResolvedValue(membership({ role: 'member' }));
    vi.mocked(households.listMembers).mockResolvedValue([]);
    await userEvent.click(await screen.findByRole('button', { name: copy.join.confirm }));
    expect(invites.joinHousehold).toHaveBeenCalledWith('ABCD2345');
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
    expect(await screen.findByText(copy.join.joinedToast)).toBeInTheDocument();
  });

  it('if the invite stops working before confirming, it says so and stays put', async () => {
    vi.mocked(invites.previewInvite).mockResolvedValue({ householdName: 'Flat 4B', memberCount: 2, expiresAt: '2030-01-01T10:00:00Z' });
    vi.mocked(invites.joinHousehold).mockRejectedValue({ message: 'invalid_invite:revoked' });
    renderApp('/start/join');
    await type('ABCD2345');
    await check();
    await userEvent.click(await screen.findByRole('button', { name: copy.join.confirm }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invite.revoked!);
    await userEvent.click(screen.getByRole('button', { name: copy.join.different }));
    expect(screen.getByLabelText(copy.join.code)).toHaveValue('ABCD-2345');
  });

  it('prefills the code from ?code=', async () => {
    renderApp('/start/join?code=ABCD2345');
    expect(await screen.findByLabelText(copy.join.code)).toHaveValue('ABCD2345');
  });

  it('shows the members and expiry without any identities', async () => {
    vi.mocked(invites.previewInvite).mockResolvedValue({ householdName: 'Flat 4B', memberCount: 2, expiresAt: '2030-01-01T10:00:00Z' });
    renderApp('/start/join');
    await type('ABCD2345');
    await check();
    const card = (await screen.findByRole('heading', { name: 'Flat 4B' })).closest('section')!;
    expect(within(card).getAllByRole('paragraph')).toHaveLength(2);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
