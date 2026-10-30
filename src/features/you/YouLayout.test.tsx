import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '@/copy';
import { mockHome } from '@/test/home';
import { membership, renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
});

const positionOf = (el: HTMLElement) => [...document.querySelectorAll('main *')].indexOf(el);

describe('You tab hierarchy', () => {
  it('goes from who you are, to the main action, to your summary, to grouped lists, with privacy and sign out last', async () => {
    renderApp('/you');
    const identity = await screen.findByRole('region', { name: copy.you.signedInAs });
    const invite = screen.getByRole('link', { name: new RegExp(copy.you.invites) });
    const summary = await screen.findByRole('region', { name: copy.you.summaryTitle });
    const household = screen.getByRole('heading', { name: copy.you.household });
    const account = screen.getByRole('heading', { name: copy.you.account });
    const about = screen.getByRole('heading', { name: copy.you.about });
    const privacy = screen.getByRole('link', { name: new RegExp(copy.you.privacy) });
    const signOut = screen.getByRole('button', { name: copy.auth.signOut });

    const order = [identity, invite, summary, household, account, about, privacy, signOut].map(positionOf);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it('groups related pages in one list each, with a chevron on every row', async () => {
    renderApp('/you');
    const household = (await screen.findByRole('heading', { name: copy.you.household })).closest('section')!;
    expect(within(household).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/you/members', '/you/household']);
    const account = screen.getByRole('heading', { name: copy.you.account }).closest('section')!;
    expect(within(account).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/you/profile', '/you/notifications']);
    const about = screen.getByRole('heading', { name: copy.you.about }).closest('section')!;
    expect(within(about).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/you/privacy']);
    expect(about.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2); // icon + chevron
  });

  it('owners and admins get "Invite roommates" at the top; plain members do not', async () => {
    renderApp('/you');
    expect(await screen.findByRole('link', { name: new RegExp(copy.you.invites) })).toHaveAttribute('href', '/you/invites');
  });

  it('a plain member sees no invite shortcut', async () => {
    mockHome({ me: membership({ role: 'member', memberId: 'm-kunal' }) });
    renderApp('/you');
    await screen.findByRole('region', { name: copy.you.signedInAs });
    expect(screen.queryByRole('link', { name: new RegExp(copy.you.invites) })).not.toBeInTheDocument();
  });

  it('the identity card has a pen that opens the profile', async () => {
    renderApp('/you');
    expect(await screen.findByRole('link', { name: copy.you.editProfile })).toHaveAttribute('href', '/you/profile');
  });
});

describe('Profile page', () => {
  it('is titled "Profile" and shows who you are above the fields', async () => {
    renderApp('/you/profile');
    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(await screen.findByText('aarav@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: copy.profileEdit.details })).toBeInTheDocument();
  });
});

describe('top bar titles', () => {
  it.each([
    ['/you', 'Settings'],
    ['/house/groceries', 'Shopping'],
    ['/chores', 'Tasks'],
    ['/expenses', 'Finance'],
    ['/activity', copy.activity.title],
    ['/you/notifications', copy.notificationPrefs.title],
  ])('%s: the page name is bold', async (path, title) => {
    renderApp(path);
    const heading = await screen.findByRole('heading', { level: 1, name: title });
    expect(heading.className).toMatch(/font-bold/);
  });
});
