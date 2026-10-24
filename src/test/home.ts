import { vi } from 'vitest';
import * as choresApi from '@/api/chores';
import * as groceriesApi from '@/api/groceries';
import * as households from '@/api/households';
import { addDays } from '@/domain';
import { todayIso } from '@/features/expenses/formModel';
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
