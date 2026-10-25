import { vi } from 'vitest';
import * as activityApi from '@/api/activity';
import * as announcementsApi from '@/api/announcements';
import * as choresApi from '@/api/chores';
import * as groceriesApi from '@/api/groceries';
import * as households from '@/api/households';
import { addDays, todayIso } from '@/domain';
import { aarav, kunal, mockApi, riya } from './render';

/** Chore and grocery test data. Tests mock `@/api/chores`, `@/api/groceries` and the household APIs. */
export const today = () => todayIso();
export const inDays = (n: number) => addDays(todayIso(), n);

export function chore(overrides: Partial<choresApi.Chore> = {}): choresApi.Chore {
  return {
    id: 'c1',
    title: 'Dishes',
    description: null,
    assigneeMemberId: 'm-riya',
    dueDate: inDays(0),
    recurrenceFrequency: null,
    rotationMemberIds: null,
    status: 'open',
    createdBy: 'u-riya',
    completedAt: null,
    completedBy: null,
    version: 1,
    createdAt: '2026-05-01T10:00:00Z',
    ...overrides,
  };
}

export function grocery(overrides: Partial<groceriesApi.GroceryItem> = {}): groceriesApi.GroceryItem {
  return {
    id: 'g1',
    name: 'Milk',
    quantity: 2,
    unit: 'l',
    category: 'Dairy',
    note: null,
    status: 'needed',
    addedByMemberId: 'm-riya',
    purchasedByMemberId: null,
    purchasedAt: null,
    version: 1,
    createdAt: '2026-05-01T10:00:00Z',
    ...overrides,
  };
}

type Me = Parameters<typeof mockApi>[0] extends infer T ? (T extends { me?: infer M } ? M : never) : never;

export function mockHome({
  me,
  members = [aarav, riya, kunal],
  open = [],
  completed = [],
  items = [],
}: { me?: Me; members?: households.Member[]; open?: choresApi.Chore[]; completed?: choresApi.Chore[]; items?: groceriesApi.GroceryItem[] } = {}) {
  mockApi({ me: me ?? undefined, members });
  vi.mocked(households.listAllMembers).mockResolvedValue(members as households.MemberWithLeft[]);
  vi.mocked(choresApi.listChores).mockResolvedValue({ open, completed });
  vi.mocked(groceriesApi.listGroceries).mockResolvedValue(items);
}

export function announcement(overrides: Partial<announcementsApi.Announcement> = {}): announcementsApi.Announcement {
  return {
    id: 'an1',
    title: 'Water off',
    body: 'Tuesday 10 to 12.',
    createdBy: 'u-riya',
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    pinnedAt: null,
    version: 1,
    ...overrides,
  };
}

export function activityEvent(overrides: Partial<activityApi.ActivityEvent> = {}): activityApi.ActivityEvent {
  return {
    id: 'e1',
    eventType: 'chore.assigned',
    actorMemberId: 'm-riya',
    entityType: 'chore',
    entityId: 'c1',
    metadata: { title: 'Dishes' },
    recipientMemberIds: ['m-aarav'],
    createdAt: '2026-05-02T10:00:00Z',
    ...overrides,
  };
}

/** Quiet hours that contain "now" (an overnight window around the current minute, so it never straddles an edge). */
export function quietAroundNow(): { quietStart: string; quietEnd: string } {
  const at = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const now = Date.now();
  return { quietStart: at(new Date(now - 3_600_000)), quietEnd: at(new Date(now + 3_600_000)) };
}

export function mockActivity({
  events = [],
  readIds = [],
  prefs = {},
}: { events?: activityApi.ActivityEvent[]; readIds?: string[]; prefs?: Partial<activityApi.NotificationPrefs> } = {}) {
  vi.mocked(activityApi.listActivity).mockResolvedValue(events);
  vi.mocked(activityApi.listReadIds).mockResolvedValue(readIds);
  vi.mocked(activityApi.getNotificationPrefs).mockResolvedValue({ categories: {}, quietEnabled: false, quietStart: null, quietEnd: null, ...prefs });
}
