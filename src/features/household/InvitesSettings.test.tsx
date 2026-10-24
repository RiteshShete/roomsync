import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as households from '@/api/households';
import * as invites from '@/api/invites';
import { copy } from '@/copy';
import * as clipboard from '@/lib/clipboard';
import { household, invite, membership, mockApi, renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/lib/clipboard');

beforeEach(() => {
  vi.resetAllMocks();
  mockApi();
  vi.mocked(clipboard.copyText).mockResolvedValue(true);
});

describe('invitations', () => {
  it('plain members are told only admins can invite, and nothing is fetched', async () => {
    mockApi({ me: membership({ role: 'member' }) });
    renderApp('/you/invites');
    expect(await screen.findByText(copy.invites.adminsOnly)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.invites.create })).not.toBeInTheDocument();
    expect(invites.listInvites).not.toHaveBeenCalled();
  });

  it('shows an empty state when there are no pending invites', async () => {
    renderApp('/you/invites');
    expect(await screen.findByText(copy.invites.pendingNone)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.invites.create })).toBeInTheDocument();
  });

  it('lists only usable invites, with a clear pending state and no full code', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    vi.mocked(invites.listInvites).mockResolvedValue([
      invite({ id: 'i-pending', codeHint: 'AB' }),
      invite({ id: 'i-used', codeHint: 'CD', useCount: 2, maxUses: null }),
      invite({ id: 'i-expired', codeHint: 'EF', expiresAt: past }),
      invite({ id: 'i-revoked', codeHint: 'GH', status: 'revoked' }),
      invite({ id: 'i-full', codeHint: 'JK', maxUses: 1, useCount: 1 }),
    ]);
    renderApp('/you/invites');
    expect(await screen.findByText('••••••AB')).toBeInTheDocument();
    expect(screen.getByText('••••••CD')).toBeInTheDocument();
    for (const gone of ['EF', 'GH', 'JK']) expect(screen.queryByText(`••••••${gone}`)).not.toBeInTheDocument();
    expect(screen.getAllByText(copy.invites.pendingState)).toHaveLength(1);
    expect(screen.getByText('Used 2 times')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.invites.createAnother })).toBeInTheDocument();
  });

  it('creates an invite with the default options and shows the code once', async () => {
    vi.mocked(invites.createInvite).mockResolvedValue({ inviteId: 'i9', code: 'ZXCV9876', expiresAt: '2030-01-01T10:00:00Z' });
    renderApp('/you/invites');
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.create }));
    const sheet = screen.getByRole('dialog', { name: copy.invites.sheetTitle });
    await userEvent.click(within(sheet).getByRole('button', { name: copy.invites.create }));
    expect(invites.createInvite).toHaveBeenCalledWith('h1', { expiresInHours: 168, maxUses: null });
    expect(await screen.findByTestId('invite-code')).toHaveTextContent('ZXCV-9876');
    await userEvent.click(screen.getByRole('button', { name: copy.invites.copy }));
    expect(clipboard.copyText).toHaveBeenCalledWith('ZXCV-9876');
    await userEvent.click(screen.getByRole('button', { name: copy.invites.close }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('ZXCV-9876')).not.toBeInTheDocument();
  });

  it('passes the chosen expiry and use limit', async () => {
    vi.mocked(invites.createInvite).mockResolvedValue({ inviteId: 'i9', code: 'ZXCV9876', expiresAt: '2030-01-01T10:00:00Z' });
    renderApp('/you/invites');
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.create }));
    await userEvent.selectOptions(screen.getByLabelText(copy.invites.expiry), '24');
    await userEvent.selectOptions(screen.getByLabelText(copy.invites.uses), '1');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.invites.create }));
    expect(invites.createInvite).toHaveBeenCalledWith('h1', { expiresInHours: 24, maxUses: 1 });
  });

  it('a failed create keeps the chosen options and says why', async () => {
    vi.mocked(invites.createInvite).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/you/invites');
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.create }));
    await userEvent.selectOptions(screen.getByLabelText(copy.invites.expiry), '720');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.invites.create }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    expect(screen.getByLabelText(copy.invites.expiry)).toHaveValue('720');
  });

  it('cancelling an invite explains the effect and then revokes it', async () => {
    vi.mocked(invites.listInvites).mockResolvedValue([invite({ id: 'i1' })]);
    vi.mocked(invites.revokeInvite).mockResolvedValue();
    renderApp('/you/invites');
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.revoke }));
    const dialog = screen.getByRole('dialog', { name: copy.invites.revokeTitle });
    expect(dialog).toHaveTextContent('stops working straight away');
    expect(invites.revokeInvite).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: copy.invites.revokeConfirm }));
    expect(invites.revokeInvite).toHaveBeenCalledWith('i1');
    expect(await screen.findByText(copy.invites.revoked)).toBeInTheDocument();
  });

  it('keeping the invite revokes nothing', async () => {
    vi.mocked(invites.listInvites).mockResolvedValue([invite()]);
    renderApp('/you/invites');
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.revoke }));
    await userEvent.click(screen.getByRole('button', { name: copy.invites.keep }));
    expect(invites.revokeInvite).not.toHaveBeenCalled();
  });

  it('a failed revoke is reported', async () => {
    vi.mocked(invites.listInvites).mockResolvedValue([invite()]);
    vi.mocked(invites.revokeInvite).mockRejectedValue({ message: 'permission_denied' });
    renderApp('/you/invites');
    await userEvent.click(await screen.findByRole('button', { name: copy.invites.revoke }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.invites.revokeConfirm }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.permission);
  });

  it('archived household: creating and cancelling are disabled with the reason on screen', async () => {
    mockApi({ me: membership({ archived: true }) });
    vi.mocked(invites.listInvites).mockResolvedValue([invite()]);
    renderApp('/you/invites');
    const create = await screen.findByRole('button', { name: copy.invites.createAnother });
    expect(create).toHaveAttribute('aria-disabled', 'true');
    expect(create).toHaveAccessibleDescription(copy.errors.householdArchived);
    await userEvent.click(create);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.invites.revoke })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText(copy.errors.householdArchived).length).toBeGreaterThanOrEqual(2);
  });

  it('shows an error with retry when the list cannot load', async () => {
    vi.mocked(invites.listInvites).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/you/invites');
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    vi.mocked(invites.listInvites).mockResolvedValue([invite()]);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByText('••••••AB')).toBeInTheDocument();
  });
});

describe('household settings', () => {
  it('lets the owner edit and saves only what changed, with the current version', async () => {
    vi.mocked(households.updateHousehold).mockResolvedValue(4);
    renderApp('/you/household');
    const save = await screen.findByRole('button', { name: copy.settings.save });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(copy.settings.nothingChanged);
    const name = screen.getByLabelText(copy.settings.name);
    await userEvent.clear(name);
    await userEvent.type(name, 'Flat 5C');
    await userEvent.click(save);
    expect(households.updateHousehold).toHaveBeenCalledWith('h1', 3, { name: 'Flat 5C' });
    expect(await screen.findByText(copy.settings.saved)).toBeInTheDocument();
  });

  it('saves several changed fields together', async () => {
    vi.mocked(households.updateHousehold).mockResolvedValue(4);
    renderApp('/you/household');
    await userEvent.selectOptions(await screen.findByLabelText(copy.settings.currency), 'USD');
    await userEvent.selectOptions(screen.getByLabelText(copy.settings.defaultSplit), 'percentage');
    await userEvent.click(screen.getByRole('switch', { name: copy.settings.choreReminders }));
    await userEvent.click(screen.getByRole('button', { name: copy.settings.save }));
    expect(households.updateHousehold).toHaveBeenCalledWith('h1', 3, { currencyCode: 'USD', defaultSplit: 'percentage', choreRemindersEnabled: false });
  });

  it('rejects an empty name without calling the API', async () => {
    renderApp('/you/household');
    await userEvent.clear(await screen.findByLabelText(copy.settings.name));
    await userEvent.click(screen.getByRole('button', { name: copy.settings.save }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.create.nameRequired);
    expect(households.updateHousehold).not.toHaveBeenCalled();
  });

  it('locks the currency once money exists, and says why', async () => {
    vi.mocked(households.householdHasMoney).mockResolvedValue(true);
    renderApp('/you/household');
    const currency = await screen.findByLabelText(copy.settings.currency);
    await vi.waitFor(() => expect(currency).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByText(copy.settings.currencyLocked)).toBeInTheDocument();
  });

  it('a failed save keeps the edits and reports the problem (rule 6)', async () => {
    vi.mocked(households.updateHousehold).mockRejectedValue({ message: 'currency_locked' });
    renderApp('/you/household');
    await userEvent.selectOptions(await screen.findByLabelText(copy.settings.currency), 'USD');
    await userEvent.click(screen.getByRole('button', { name: copy.settings.save }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.currencyLocked);
    expect(screen.getByLabelText(copy.settings.currency)).toHaveValue('USD');
  });

  it('a version conflict keeps the edits and offers a refresh', async () => {
    vi.mocked(households.updateHousehold).mockRejectedValue({ message: 'conflict' });
    renderApp('/you/household');
    const name = await screen.findByLabelText(copy.settings.name);
    await userEvent.clear(name);
    await userEvent.type(name, 'My edit');
    await userEvent.click(screen.getByRole('button', { name: copy.settings.save }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.conflict);
    expect(name).toHaveValue('My edit');
    const before = vi.mocked(households.getHousehold).mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: copy.settings.refresh }));
    await vi.waitFor(() => expect(vi.mocked(households.getHousehold).mock.calls.length).toBeGreaterThan(before));
    expect(screen.getByLabelText(copy.settings.name)).toHaveValue('My edit');
  });

  it('members see the settings read-only with the reason, and cannot save', async () => {
    mockApi({ me: membership({ role: 'member' }) });
    renderApp('/you/household');
    expect(await screen.findByText(copy.settings.readOnly)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.settings.name)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(copy.settings.currency)).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('switch', { name: copy.settings.choreReminders })).toHaveAttribute('aria-disabled', 'true');
    const save = screen.getByRole('button', { name: copy.settings.save });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(save);
    expect(households.updateHousehold).not.toHaveBeenCalled();
  });

  it('admins can edit settings but cannot archive', async () => {
    mockApi({ me: membership({ role: 'admin' }) });
    renderApp('/you/household');
    expect(await screen.findByLabelText(copy.settings.name)).not.toHaveAttribute('readonly');
    const archive = screen.getByRole('button', { name: copy.settings.archive });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    expect(archive).toHaveAccessibleDescription(copy.settings.ownerOnly);
  });

  it('the owner archives only after reading the consequences', async () => {
    vi.mocked(households.setHouseholdArchived).mockResolvedValue(4);
    renderApp('/you/household');
    await userEvent.click(await screen.findByRole('button', { name: copy.settings.archive }));
    const dialog = screen.getByRole('dialog', { name: copy.settings.archiveConfirmTitle });
    expect(dialog).toHaveTextContent('no one can add or change anything until you restore it');
    expect(dialog).toHaveTextContent('Nothing is deleted');
    expect(households.setHouseholdArchived).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: copy.settings.archiveConfirm }));
    expect(households.setHouseholdArchived).toHaveBeenCalledWith('h1', true);
    expect(await screen.findByText(copy.settings.archived)).toBeInTheDocument();
  });

  it('cancelling the archive confirmation archives nothing', async () => {
    renderApp('/you/household');
    await userEvent.click(await screen.findByRole('button', { name: copy.settings.archive }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(households.setHouseholdArchived).not.toHaveBeenCalled();
  });

  it('an archived household shows the banner, read-only settings, and lets only the owner restore', async () => {
    mockApi({ me: membership({ archived: true }) });
    vi.mocked(households.getHousehold).mockResolvedValue(household({ status: 'archived' }));
    vi.mocked(households.setHouseholdArchived).mockResolvedValue(5);
    renderApp('/you/household');
    expect(await screen.findByText(copy.settings.banner)).toBeInTheDocument();
    expect(await screen.findByLabelText(copy.settings.name)).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: copy.settings.save })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: copy.settings.restore }));
    expect(households.setHouseholdArchived).toHaveBeenCalledWith('h1', false);
    expect(await screen.findByText(copy.settings.restored)).toBeInTheDocument();
  });

  it('an admin cannot restore an archived household', async () => {
    mockApi({ me: membership({ role: 'admin', archived: true }) });
    renderApp('/you/household');
    const restore = await screen.findByRole('button', { name: copy.settings.restore });
    expect(restore).toHaveAttribute('aria-disabled', 'true');
    expect(restore).toHaveAccessibleDescription(copy.settings.ownerOnly);
  });
});
