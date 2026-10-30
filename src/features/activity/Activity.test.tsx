import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/api/activity';
import { copy } from '@/copy';
import { todayIso } from '@/domain';
import { activityEvent, mockActivity, mockHome, quietAroundNow } from '@/test/home';
import { QueryClient } from '@tanstack/react-query';
import { membership, renderApp, signedIn } from '@/test/render';
import { describeEvent, eventLink } from './describe';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

const nameOf = (id: string | null) => ({ 'm-aarav': 'Aarav', 'm-riya': 'Riya', 'm-kunal': 'Kunal' })[id ?? ''] ?? 'Former member';

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
});

const events = [
  activityEvent({ id: 'e1', eventType: 'chore.assigned', createdAt: '2026-05-02T10:00:00Z' }),
  activityEvent({ id: 'e2', eventType: 'expense.added', entityType: 'expense', entityId: 'x9', metadata: { title: 'Dinner', amount_minor: 100000, currency_code: 'INR' }, createdAt: '2026-05-03T10:00:00Z' }),
  activityEvent({ id: 'e3', eventType: 'announcement.posted', entityType: 'announcement', metadata: { title: 'Water off' }, createdAt: '2026-05-04T10:00:00Z' }),
  activityEvent({ id: 'e4', eventType: 'grocery.added', metadata: { name: 'Milk' }, recipientMemberIds: ['m-kunal'], createdAt: '2026-05-05T10:00:00Z' }),
];

describe('describeEvent and eventLink', () => {
  it('writes one neutral sentence from names, titles and amounts only', () => {
    expect(describeEvent(events[0]!, nameOf)).toBe('Riya assigned you a chore: Dishes');
    expect(describeEvent(events[1]!, nameOf)).toBe('Riya added an expense: Dinner · ₹1,000.00');
    expect(describeEvent(events[3]!, nameOf)).toBe('Riya added Milk to the grocery list');
  });

  it('system events have no actor; unknown types still read sensibly', () => {
    expect(describeEvent(activityEvent({ eventType: 'chore.reminder', actorMemberId: null }), nameOf)).toBe('Dishes: this chore is still waiting to be completed.');
    expect(describeEvent(activityEvent({ eventType: 'brand.new', actorMemberId: null }), nameOf)).toBe('Someone made a change');
  });

  it.each([
    ['expense.added', 'x9', '/expenses/x9'],
    ['settlement.recorded', 's1', '/expenses/settlements'],
    ['chore.completed', 'c1', '/chores'],
    ['chore.reminder', 'c1', '/chores'],
    ['grocery.purchased', 'g1', '/house/groceries'],
    ['announcement.pinned', 'a1', '/house/announcements'],
    ['member.joined', 'm1', '/you/members'],
    ['household.archived', 'h1', '/you/household'],
  ])('%s opens %s', (eventType, entityId, to) => expect(eventLink({ eventType, entityType: 'x', entityId })).toBe(to));

  it('every event type the app can show has a sentence (nothing falls back silently)', () => {
    for (const type of Object.keys(copy.activity.lines)) {
      expect(describeEvent(activityEvent({ eventType: type }), nameOf)).not.toBe(copy.activity.fallback('Riya'));
    }
  });
});

describe('the bell', () => {
  it('shows how many updates are unread, only those addressed to me, and opens the activity centre', async () => {
    mockActivity({ events, readIds: ['e1'] });
    renderApp('/');
    const bell = await screen.findByRole('button', { name: copy.header.notificationsUnread(2) });
    await userEvent.click(bell);
    expect(await screen.findByRole('heading', { level: 1, name: copy.activity.title })).toBeInTheDocument();
  });

  it('no number when everything is read', async () => {
    mockActivity({ events, readIds: ['e1', 'e2', 'e3'] });
    renderApp('/');
    expect(await screen.findByRole('button', { name: copy.header.notifications })).toBeInTheDocument();
  });

  it('a switched-off category leaves the badge and the list', async () => {
    mockActivity({ events, prefs: { categories: { announcements: false, expenses: false } } });
    renderApp('/');
    expect(await screen.findByRole('button', { name: copy.header.notificationsUnread(1) })).toBeInTheDocument();
  });

  it('quiet hours hide the badge number', async () => {
    mockActivity({ events, prefs: { quietEnabled: true, ...quietAroundNow() } });
    renderApp('/');
    expect(await screen.findByRole('button', { name: copy.header.notifications })).toBeInTheDocument();
  });

  it('quiet hours pause only the badge; the updates are still listed, with a note', async () => {
    mockActivity({ events, prefs: { quietEnabled: true, ...quietAroundNow() } });
    renderApp('/activity');
    expect(await screen.findByText(copy.activity.quietNote)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Riya added an expense: Dinner/ })).toBeInTheDocument();
  });
});

describe('activity centre', () => {
  it('lists only my updates, newest first, with category and unread marks', async () => {
    mockActivity({ events, readIds: ['e3'] });
    renderApp('/activity');
    const list = await screen.findByRole('group', { name: copy.activity.title });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Riya posted an announcement: Water off');
    expect(rows[1]).toHaveTextContent('Riya added an expense: Dinner');
    expect(rows[2]).toHaveTextContent('Riya assigned you a chore: Dishes');
    expect(within(rows[0]!).queryByText(`${copy.activity.unreadAria}:`, { exact: false })).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText(`${copy.activity.unreadAria}:`, { exact: false })).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/Expenses:/)).toBeInTheDocument();
  });

  it('opening an update marks it read and goes to the right screen', async () => {
    mockActivity({ events });
    vi.mocked(api.markActivityRead).mockResolvedValue();
    renderApp('/activity');
    await userEvent.click(await screen.findByRole('link', { name: /Riya assigned you a chore: Dishes/ }));
    expect(api.markActivityRead).toHaveBeenCalledWith('e1');
    expect(await screen.findByRole('heading', { level: 1, name: copy.chores.title })).toBeInTheDocument();
  });

  it('opening an already-read update does not call the server again', async () => {
    mockActivity({ events, readIds: ['e1'] });
    renderApp('/activity');
    await userEvent.click(await screen.findByRole('link', { name: /Riya assigned you a chore/ }));
    expect(api.markActivityRead).not.toHaveBeenCalled();
  });

  it('mark all as read calls the server and says so; it is disabled with a reason when nothing is unread', async () => {
    mockActivity({ events });
    vi.mocked(api.markAllActivityRead).mockResolvedValue(3);
    renderApp('/activity');
    await userEvent.click(await screen.findByRole('button', { name: copy.activity.markAll }));
    expect(api.markAllActivityRead).toHaveBeenCalledWith('h1');
    expect(await screen.findByText(copy.activity.markedAll)).toBeInTheDocument();
  });

  it('nothing unread: the button is disabled and says why', async () => {
    mockActivity({ events, readIds: ['e1', 'e2', 'e3'] });
    renderApp('/activity');
    const button = await screen.findByRole('button', { name: copy.activity.markAll });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(copy.activity.nothingToMark);
  });

  it('shows how many are unread, and "all caught up" when none are', async () => {
    mockActivity({ events, readIds: ['e1'] });
    renderApp('/activity');
    expect(await screen.findByText(copy.activity.unreadCount(2))).toBeInTheDocument();
  });

  it('all caught up when everything is read', async () => {
    mockActivity({ events, readIds: ['e1', 'e2', 'e3'] });
    renderApp('/activity');
    expect(await screen.findByText(copy.activity.caughtUp)).toBeInTheDocument();
  });

  it('groups the cards under day labels and shows how long ago', async () => {
    mockActivity({ events: [activityEvent({ id: 'n1', createdAt: new Date().toISOString() }), activityEvent({ id: 'n2', createdAt: new Date(Date.now() - 86_400_000).toISOString() })] });
    renderApp('/activity');
    const list = await screen.findByRole('group', { name: copy.activity.title });
    expect(within(list).getByRole('heading', { level: 3, name: 'Today' })).toBeInTheDocument();
    expect(within(list).getByRole('heading', { level: 3, name: 'Yesterday' })).toBeInTheDocument();
    expect(within(list).getByText('Just now')).toBeInTheDocument();
  });

  it('the actor is in bold and the category is a tile, spoken as text', async () => {
    mockActivity({ events: [events[1]!] });
    renderApp('/activity');
    const row = within(await screen.findByRole('group', { name: copy.activity.title })).getByRole('listitem');
    expect(within(row).getByText('Riya').tagName).toBe('STRONG');
    expect(within(row).getByText(/Expenses:/)).toHaveClass('sr-only');
  });

  it('filters by category from the Filter menu', async () => {
    mockActivity({ events });
    renderApp('/activity');
    await userEvent.click(await screen.findByRole('button', { name: copy.activity.filter }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Expenses' }));
    expect(within(screen.getByRole('group', { name: copy.activity.title })).getAllByRole('listitem')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: copy.activity.filter }));
    expect(screen.getByRole('menuitemradio', { name: 'Expenses' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: copy.activity.all }));
    expect(within(screen.getByRole('group', { name: copy.activity.title })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('Escape closes the Filter menu and returns focus to its button', async () => {
    mockActivity({ events });
    renderApp('/activity');
    const button = await screen.findByRole('button', { name: copy.activity.filter });
    await userEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('empty state, then an error with retry', async () => {
    mockActivity();
    renderApp('/activity');
    expect(await screen.findByText(copy.activity.emptyTitle)).toBeInTheDocument();
  });

  it('a failed load can be retried', async () => {
    mockActivity({ events });
    vi.mocked(api.listActivity).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/activity');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByRole('link', { name: /Riya assigned you a chore/ })).toBeInTheDocument();
  });
});

describe('Home: recent activity', () => {
  it('shows the latest updates with a link to all of them', async () => {
    mockActivity({ events });
    renderApp('/');
    expect(await screen.findByRole('link', { name: /Riya assigned you a chore: Dishes/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.activity.seeAll })).toHaveAttribute('href', '/activity');
  });

  it('shows at most twenty', async () => {
    mockActivity({ events: Array.from({ length: 25 }, (_, i) => activityEvent({ id: `n${i}`, createdAt: `2026-05-01T10:00:${String(i).padStart(2, '0')}Z` })) });
    renderApp('/');
    const list = await screen.findByRole('group', { name: copy.activity.recent });
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
  });

  it('with nothing yet, shows the "Your house is ready" state', async () => {
    mockActivity();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: copy.home.emptyTitle })).toBeInTheDocument();
  });
});

describe('chore reminders (in-app only)', () => {
  it('asks for today’s reminders once when the household opens, using the device’s date', async () => {
    mockActivity();
    vi.mocked(api.syncChoreReminders).mockResolvedValue(1);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderApp('/', signedIn, client);
    await vi.waitFor(() => expect(api.syncChoreReminders).toHaveBeenCalledWith('h1', todayIso()));
    // new reminders mark the activity data stale so the list and the bell refresh
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['activity'] }), { timeout: 4000 });
  });

  it('does nothing for an archived household', async () => {
    mockHome({ me: membership({ archived: true }) });
    mockActivity();
    renderApp('/');
    await screen.findByText(copy.settings.banner);
    expect(api.syncChoreReminders).not.toHaveBeenCalled();
  });

  it('a failed reminder sync never interrupts the user', async () => {
    mockActivity();
    vi.mocked(api.syncChoreReminders).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
