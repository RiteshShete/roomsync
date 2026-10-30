import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as announcementsApi from '@/api/announcements';
import * as chatApi from '@/api/chat';
import * as expensesApi from '@/api/expenses';
import * as households from '@/api/households';
import { copy } from '@/copy';
import { activityEvent, announcement, mockActivity } from '@/test/home';
import { mockMoney } from '@/test/money';
import { aarav, kunal, membership, mockApi, renderApp, riya } from '@/test/render';
import { formatInviteCode } from '@/domain';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/api/chat');

beforeEach(() => {
  vi.resetAllMocks();
  mockApi();
  vi.mocked(chatApi.listMessages).mockResolvedValue([]);
  vi.mocked(chatApi.sendMessage).mockResolvedValue();
  window.localStorage.clear();
});

describe('Home (from the design)', () => {
  it('shows the logo and name, the House Feed card and the housemates; the household name is the page heading', async () => {
    mockMoney();
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat 4B' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: copy.feed.title })).toBeInTheDocument();
    expect(screen.getByText(copy.brand.name)).toBeInTheDocument();
    const members = await screen.findByRole('link', { name: '3 members' });
    expect(members).toHaveAttribute('href', '/you/members');
    expect(within(members).getByRole('group', { name: '3 members' })).toBeInTheDocument();
  });

  it('uses the design’s own artwork: the logo image and the feed icons', async () => {
    mockMoney();
    const { container } = renderApp('/');
    await screen.findByRole('heading', { level: 2, name: copy.feed.title });
    // small SVGs are inlined as data URIs by the build, so recognise each design asset by its own content
    const sources = [...container.querySelectorAll('img')].map((i) => decodeURIComponent(i.getAttribute('src') ?? ''));
    const has = (marker: RegExp) => sources.some((s) => marker.test(s));
    expect(has(/assets\/brand\/logo/), 'the design logo').toBe(true);
    expect(has(/typcn:flash/), 'the flash icon').toBe(true);
    expect(has(/family-home-rounded/), 'the family-home icon').toBe(true);
    expect(has(/CaretDown/), 'the caret').toBe(true);
    expect(sources.some((s) => /figma\.com/.test(s)), 'no temporary Figma URLs').toBe(false);
  });

  it.each([
    [[{ memberId: 'm-aarav', netMinor: -12500 }], `${copy.feed.youOwe} ₹125.00`],
    [[{ memberId: 'm-aarav', netMinor: 4000 }], `${copy.feed.youAreOwed} ₹40.00`],
    [[], copy.feed.settled],
  ])('the money line for balance %j reads "%s" and opens Balances', async (balances, text) => {
    mockMoney({ balances });
    renderApp('/');
    const line = await screen.findByRole('link', { name: text });
    expect(line).toHaveAttribute('href', '/expenses/balances');
  });

  it('the announcement line shows the latest announcement and who posted it', async () => {
    mockMoney();
    vi.mocked(announcementsApi.listAnnouncements).mockResolvedValue([announcement({ title: 'Landlord visit', createdBy: 'u-riya' })]);
    renderApp('/');
    const line = await screen.findByRole('link', { name: /Landlord visit/ });
    expect(line).toHaveTextContent('Landlord visit · Riya');
    expect(line).toHaveAttribute('href', '/house/announcements');
  });

  it('with no announcements it says so, and still links to the announcements page', async () => {
    mockMoney();
    renderApp('/');
    expect(await screen.findByRole('link', { name: copy.feed.noAnnouncements })).toHaveAttribute('href', '/house/announcements');
  });

  it('the card collapses and expands from its button', async () => {
    mockMoney();
    renderApp('/');
    const toggle = await screen.findByRole('button', { name: copy.feed.collapse });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(list).toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: copy.feed.expand })).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: copy.feed.expand }));
    expect(list).toBeVisible();
  });

  it('an owner who is alone gets an invite line in the feed, and the link works', async () => {
    mockMoney({ members: [aarav] });
    renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: new RegExp(copy.feed.invite) }));
    expect(await screen.findByRole('heading', { level: 1, name: copy.invites.title })).toBeInTheDocument();
  });

  it('a plain member who is alone sees no invite line', async () => {
    mockMoney({ me: membership({ role: 'member', memberId: 'm-kunal' }), members: [kunal] });
    renderApp('/');
    await screen.findByRole('heading', { level: 2, name: copy.feed.title });
    expect(screen.queryByRole('link', { name: new RegExp(copy.feed.invite) })).not.toBeInTheDocument();
  });

  it('no invite line when housemates are already here', async () => {
    mockMoney({ members: [aarav, riya] });
    renderApp('/');
    await screen.findByRole('link', { name: '2 members' });
    expect(screen.queryByRole('link', { name: new RegExp(copy.feed.invite) })).not.toBeInTheDocument();
  });

  it('a feed line that cannot load says so and can be retried, without breaking the rest', async () => {
    mockMoney();
    vi.mocked(expensesApi.getBalances).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: copy.feed.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByRole('link', { name: new RegExp(copy.feed.youAreOwed) })).toBeInTheDocument();
  });

  it('the members list failing shows an error with retry, then recovers', async () => {
    vi.mocked(households.listMembers).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    vi.mocked(households.listMembers).mockResolvedValue([aarav, riya]);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByRole('link', { name: '2 members' })).toBeInTheDocument();
  });

  it('below the card is the household’s activity, with a link to all of it', async () => {
    mockMoney();
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 2, name: copy.activity.recent })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.activity.seeAll })).toHaveAttribute('href', '/activity');
    expect(await screen.findByRole('heading', { name: copy.home.emptyTitle })).toBeInTheDocument();
  });

  it('keeps the bell, with the unread count', async () => {
    mockMoney();
    mockActivity({ events: [activityEvent()] });
    renderApp('/');
    expect(await screen.findByRole('button', { name: copy.header.notificationsUnread(1) })).toBeInTheDocument();
  });

  it('has no points anywhere, and no leaderboard', async () => {
    mockMoney();
    renderApp('/');
    await screen.findByRole('heading', { level: 2, name: copy.feed.title });
    expect(document.body.textContent).not.toMatch(/points|#1 this week|leaderboard/i);
  });

  it('Activity is the default tab; Message opens the chat with its composer', async () => {
    mockMoney();
    renderApp('/');
    expect(await screen.findByRole('tab', { name: copy.activity.recent })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText(copy.chat.label)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: copy.chat.title }));
    expect(await screen.findByLabelText(copy.chat.label)).toBeInTheDocument();
    expect(await screen.findByText(copy.chat.emptyTitle)).toBeInTheDocument();
  });

  it('shows messages with who sent them, and sends a new one', async () => {
    mockMoney();
    vi.mocked(chatApi.listMessages).mockResolvedValue([
      { id: 'c1', senderMemberId: 'm-riya', body: 'Milk is finished', createdAt: new Date().toISOString() },
      { id: 'c2', senderMemberId: 'm-aarav', body: 'I will buy it', createdAt: new Date().toISOString() },
    ]);
    renderApp('/');
    await userEvent.click(await screen.findByRole('tab', { name: copy.chat.title }));
    expect(await screen.findByText('Milk is finished')).toBeInTheDocument();
    expect(screen.getByText('I will buy it')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: copy.chat.send });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(screen.getByLabelText(copy.chat.label), '  See you at 8  ');
    await userEvent.click(send);
    expect(chatApi.sendMessage).toHaveBeenCalledWith('h1', 'm-aarav', 'See you at 8');
    expect(screen.getByLabelText(copy.chat.label)).toHaveValue('');
  });

  it('a failed send keeps what was typed and says so', async () => {
    mockMoney();
    vi.mocked(chatApi.sendMessage).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/');
    await userEvent.click(await screen.findByRole('tab', { name: copy.chat.title }));
    await userEvent.type(await screen.findByLabelText(copy.chat.label), 'Important');
    await userEvent.click(screen.getByRole('button', { name: copy.chat.send }));
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.chat.label)).toHaveValue('Important');
  });

  it('an archived household is read-only: sending is disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }) });
    renderApp('/');
    await userEvent.click(await screen.findByRole('tab', { name: copy.chat.title }));
    const input = await screen.findByLabelText(copy.chat.label);
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByText(copy.errors.householdArchived)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.chat.send }));
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
  });

  it('a dot marks unread messages on the Message tab until it is opened', async () => {
    mockMoney();
    vi.mocked(chatApi.listMessages).mockResolvedValue([{ id: 'c1', senderMemberId: 'm-riya', body: 'Hi', createdAt: new Date().toISOString() }]);
    renderApp('/');
    const tab = await screen.findByRole('tab', { name: /Message/ });
    await vi.waitFor(() => expect(tab).toHaveTextContent(copy.chat.newMessages));
    await userEvent.click(tab);
    await userEvent.click(screen.getByRole('tab', { name: copy.activity.recent }));
    expect(screen.getByRole('tab', { name: /Message/ })).not.toHaveTextContent(copy.chat.newMessages);
  });

  it('has no quick-add buttons any more: the bottom bar and each screen cover that', async () => {
    mockMoney();
    renderApp('/');
    await screen.findByRole('heading', { level: 2, name: copy.feed.title });
    expect(screen.queryByRole('link', { name: 'Add expense' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add chore' })).not.toBeInTheDocument();
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

  it('the bottom nav keeps "Settings" current on sub-pages', async () => {
    renderApp('/you/household');
    await screen.findByRole('heading', { level: 1, name: copy.settings.title });
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
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
