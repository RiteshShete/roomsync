import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/api/activity';
import { copy } from '@/copy';
import { activityEvent, mockActivity, mockHome } from '@/test/home';
import { renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
});

describe('activity: edge cases', () => {
  it('an event from someone who has since left still reads sensibly', async () => {
    mockActivity({ events: [activityEvent({ actorMemberId: 'm-gone', eventType: 'expense.added', metadata: { title: 'Pizza' } })] });
    renderApp('/activity');
    expect(await screen.findByRole('link', { name: /Former member added an expense: Pizza/ })).toBeInTheDocument();
  });

  it('metadata with the wrong types never crashes the list', async () => {
    mockActivity({
      events: [
        activityEvent({ metadata: { title: 42, amount_minor: 'lots', currency_code: null } as never }),
        activityEvent({ id: 'e2', eventType: 'expense.added', metadata: { title: { nested: true } } as never }),
      ],
    });
    renderApp('/activity');
    expect(await within(await screen.findByRole('group', { name: copy.activity.title })).findAllByRole('listitem')).toHaveLength(2);
  });

  it('markup in an event title is plain text', async () => {
    mockActivity({ events: [activityEvent({ eventType: 'chore.assigned', metadata: { title: '<b>bold</b>' } })] });
    renderApp('/activity');
    expect(await screen.findByText(/<b>bold<\/b>/)).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });

  it('mark all as read failing tells the user and keeps the list', async () => {
    mockActivity({ events: [activityEvent()] });
    vi.mocked(api.markAllActivityRead).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/activity');
    await userEvent.click(await screen.findByRole('button', { name: copy.activity.markAll }));
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Riya assigned you a chore/ })).toBeInTheDocument();
  });

  it('when every event is in a switched-off category, the filter goes away and the empty state shows', async () => {
    mockActivity({ events: [activityEvent()], prefs: { categories: { chores: false } } });
    renderApp('/activity');
    expect(await screen.findByText(copy.activity.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.activity.filter })).not.toBeInTheDocument();
  });

  it('a large unread count shows as 9+ on the badge and in full to screen readers', async () => {
    mockActivity({ events: Array.from({ length: 25 }, (_, i) => activityEvent({ id: `n${i}`, createdAt: `2026-05-01T10:00:${String(i).padStart(2, '0')}Z` })) });
    renderApp('/');
    expect(await screen.findByRole('button', { name: copy.header.notificationsUnread(25) })).toBeInTheDocument();
    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});
