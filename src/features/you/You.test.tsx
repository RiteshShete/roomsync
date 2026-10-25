import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as activity from '@/api/activity';
import * as chores from '@/api/chores';
import * as expenses from '@/api/expenses';
import * as profile from '@/api/profile';
import { copy } from '@/copy';
import * as download from '@/lib/download';
import { chore, mockActivity, mockHome } from '@/test/home';
import { membership, renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/lib/download');

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
});

describe('You tab', () => {
  it('links to profile, notifications, privacy and the household pages', async () => {
    renderApp('/you');
    expect(await screen.findByRole('link', { name: new RegExp(copy.you.profile) })).toHaveAttribute('href', '/you/profile');
    expect(screen.getByRole('link', { name: new RegExp(copy.you.notifications) })).toHaveAttribute('href', '/you/notifications');
    expect(screen.getByRole('link', { name: new RegExp(copy.you.privacy) })).toHaveAttribute('href', '/you/privacy');
    expect(screen.getByRole('link', { name: new RegExp(copy.you.members) })).toHaveAttribute('href', '/you/members');
  });

  it('personal summary: what I owe, what I am owed, and my open chores (not other people’s); no rankings', async () => {
    vi.mocked(expenses.getBalances).mockResolvedValue([{ memberId: 'm-aarav', netMinor: -12_500 }, { memberId: 'm-riya', netMinor: 12_500 }]);
    vi.mocked(chores.listChores).mockResolvedValue({
      open: [chore({ id: '1', assigneeMemberId: 'm-aarav' }), chore({ id: '2', assigneeMemberId: 'm-aarav' }), chore({ id: '3', assigneeMemberId: 'm-riya' }), chore({ id: '4', assigneeMemberId: null })],
      completed: [],
    });
    renderApp('/you');
    const summary = await screen.findByRole('region', { name: copy.you.summaryTitle });
    expect(within(summary).getByText(copy.you.summaryOwe).nextElementSibling).toHaveTextContent('₹125.00');
    expect(within(summary).getByText(copy.you.summaryOwed).nextElementSibling).toHaveTextContent('₹0.00');
    expect(within(summary).getByText(copy.you.summaryChores).nextElementSibling).toHaveTextContent('2');
    expect(document.body.textContent).not.toMatch(/leaderboard|rank|points|score/i);
  });

  it('when I am owed money it shows under "You are owed"', async () => {
    vi.mocked(expenses.getBalances).mockResolvedValue([{ memberId: 'm-aarav', netMinor: 4_000 }]);
    renderApp('/you');
    const summary = await screen.findByRole('region', { name: copy.you.summaryTitle });
    expect(within(summary).getByText(copy.you.summaryOwed).nextElementSibling).toHaveTextContent('₹40.00');
    expect(within(summary).getByText(copy.you.summaryOwe).nextElementSibling).toHaveTextContent('₹0.00');
  });

  it('a failed summary says so without breaking the page', async () => {
    vi.mocked(expenses.getBalances).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/you');
    expect(await screen.findByText(new RegExp(copy.you.summaryError))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.auth.signOut })).toBeInTheDocument();
  });
});

describe('edit profile', () => {
  it('starts from my saved profile, keeps Save disabled until something changes, then saves', async () => {
    vi.mocked(profile.updateMyProfile).mockResolvedValue();
    renderApp('/you/profile');
    const name = await screen.findByLabelText(copy.profileEdit.name);
    expect(name).toHaveValue('Aarav');
    const save = screen.getByRole('button', { name: copy.profileEdit.save });
    expect(save).toHaveAccessibleDescription(copy.profileEdit.reasonSame);
    await userEvent.clear(name);
    expect(save).toHaveAccessibleDescription(copy.profileEdit.reasonName);
    await userEvent.type(name, 'Aarav K');
    await userEvent.click(screen.getByRole('button', { name: copy.profileEdit.colorOption('Green') }));
    expect(screen.getByRole('button', { name: copy.profileEdit.colorOption('Green') })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(save);
    expect(profile.updateMyProfile).toHaveBeenCalledWith('u-aarav', { displayName: 'Aarav K', avatarColor: '#0B8A63' });
    expect(await screen.findByText(copy.profileEdit.saved)).toBeInTheDocument();
  });

  it('a failed save keeps what was typed', async () => {
    vi.mocked(profile.updateMyProfile).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/you/profile');
    const name = await screen.findByLabelText(copy.profileEdit.name);
    await userEvent.type(name, ' Kumar');
    await userEvent.click(screen.getByRole('button', { name: copy.profileEdit.save }));
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(name).toHaveValue('Aarav Kumar');
  });
});

describe('notification preferences', () => {
  it('shows each category as a switch (missing = on) and says precisely what quiet hours do', async () => {
    mockActivity({ prefs: { categories: { groceries: false } } });
    renderApp('/you/notifications');
    expect(await screen.findByRole('switch', { name: 'Expenses' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Groceries' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/no push notifications, email or texts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.notificationPrefs.save })).toHaveAccessibleDescription(copy.notificationPrefs.reasonSame);
  });

  it('turning a category off saves only the switched-off categories', async () => {
    mockActivity();
    vi.mocked(activity.saveNotificationPrefs).mockResolvedValue();
    renderApp('/you/notifications');
    await userEvent.click(await screen.findByRole('switch', { name: 'Chores' }));
    await userEvent.click(screen.getByRole('button', { name: copy.notificationPrefs.save }));
    expect(activity.saveNotificationPrefs).toHaveBeenCalledWith('m-aarav', { categories: { chores: false }, quietEnabled: false, quietStart: null, quietEnd: null });
    expect(await screen.findByText(copy.notificationPrefs.saved)).toBeInTheDocument();
  });

  it('quiet hours need both times; with them it saves', async () => {
    mockActivity();
    vi.mocked(activity.saveNotificationPrefs).mockResolvedValue();
    renderApp('/you/notifications');
    await userEvent.click(await screen.findByRole('switch', { name: copy.notificationPrefs.quietToggle }));
    const save = screen.getByRole('button', { name: copy.notificationPrefs.save });
    expect(save).toHaveAccessibleDescription(copy.notificationPrefs.reasonTimes);
    await userEvent.type(screen.getByLabelText(copy.notificationPrefs.from), '22:00');
    await userEvent.type(screen.getByLabelText(copy.notificationPrefs.to), '07:00');
    await userEvent.click(save);
    expect(activity.saveNotificationPrefs).toHaveBeenCalledWith('m-aarav', { categories: {}, quietEnabled: true, quietStart: '22:00', quietEnd: '07:00' });
  });

  it('a failed save keeps the switches as set', async () => {
    mockActivity();
    vi.mocked(activity.saveNotificationPrefs).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/you/notifications');
    await userEvent.click(await screen.findByRole('switch', { name: 'Expenses' }));
    await userEvent.click(screen.getByRole('button', { name: copy.notificationPrefs.save }));
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Expenses' })).toHaveAttribute('aria-checked', 'false');
  });

  it('a switched-off category really disappears from the activity centre', async () => {
    mockActivity({ prefs: { categories: { chores: false } }, events: [{ id: 'e1', eventType: 'chore.assigned', actorMemberId: 'm-riya', entityType: 'chore', entityId: 'c', metadata: { title: 'Dishes' }, recipientMemberIds: ['m-aarav'], createdAt: '2026-05-02T10:00:00Z' }] });
    renderApp('/activity');
    expect(await screen.findByText(copy.activity.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByText(/Dishes/)).not.toBeInTheDocument();
  });

  it('archived household: saving is disabled with the reason', async () => {
    mockHome({ me: membership({ archived: true }) });
    mockActivity();
    renderApp('/you/notifications');
    await userEvent.click(await screen.findByRole('switch', { name: 'Chores' }));
    expect(screen.getByRole('button', { name: copy.notificationPrefs.save })).toHaveAccessibleDescription(copy.errors.householdArchived);
  });
});

describe('privacy, help and your data', () => {
  it('states what is stored and what is not done, and is honest about deleting an account', async () => {
    renderApp('/you/privacy');
    expect(await screen.findByText(copy.privacy.stores)).toBeInTheDocument();
    expect(screen.getByText(copy.privacy.not)).toBeInTheDocument();
    expect(screen.getByText(copy.privacy.deleteBody)).toBeInTheDocument();
    expect(copy.privacy.deleteBody).toMatch(/not available yet/);
  });

  it('downloads my data as a file named for today', async () => {
    vi.mocked(profile.exportMyHouseholdData).mockResolvedValue({ schema_version: 1 });
    renderApp('/you/privacy');
    await userEvent.click(await screen.findByRole('button', { name: copy.privacy.exportButton }));
    expect(profile.exportMyHouseholdData).toHaveBeenCalledWith('h1');
    await vi.waitFor(() => expect(download.downloadJson).toHaveBeenCalledWith(expect.stringMatching(/^roomsync-\d{4}-\d{2}-\d{2}\.json$/), { schema_version: 1 }));
    expect(await screen.findByText(copy.privacy.exported)).toBeInTheDocument();
  });

  it('a failed export says so and nothing is downloaded', async () => {
    vi.mocked(profile.exportMyHouseholdData).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/you/privacy');
    await userEvent.click(await screen.findByRole('button', { name: copy.privacy.exportButton }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.privacy.exportFailed);
    expect(download.downloadJson).not.toHaveBeenCalled();
  });
});
