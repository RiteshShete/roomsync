import { vi } from 'vitest';
import * as expensesApi from '@/api/expenses';
import * as households from '@/api/households';
import * as settlementsApi from '@/api/settlements';
import { aarav, kunal, mockApi, riya } from './render';

/** Money test data. Tests mock `@/api/expenses`, `@/api/settlements` and the household/invite APIs. */
export function expense(overrides: Partial<expensesApi.Expense> = {}): expensesApi.Expense {
  return {
    id: 'e1',
    title: 'Electricity bill',
    amountMinor: 120000,
    currencyCode: 'INR',
    category: 'utilities',
    paidByMemberId: 'm-riya',
    expenseDate: '2026-05-01',
    notes: null,
    splitMethod: 'equal',
    createdBy: 'u-riya',
    updatedBy: null,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    deletedAt: null,
    deletedBy: null,
    version: 1,
    shares: [
      { memberId: 'm-aarav', shareAmountMinor: 40000, percentBp: null },
      { memberId: 'm-riya', shareAmountMinor: 40000, percentBp: null },
      { memberId: 'm-kunal', shareAmountMinor: 40000, percentBp: null },
    ],
    ...overrides,
  };
}

export function settlement(overrides: Partial<settlementsApi.Settlement> = {}): settlementsApi.Settlement {
  return {
    id: 's1',
    fromMemberId: 'm-kunal',
    toMemberId: 'm-aarav',
    amountMinor: 30000,
    currencyCode: 'INR',
    settlementDate: '2026-05-02',
    note: null,
    recordedBy: 'u-kunal',
    status: 'recorded',
    statusChangedBy: null,
    statusChangedAt: null,
    statusReason: null,
    createdAt: '2026-05-02T10:00:00Z',
    version: 1,
    ...overrides,
  };
}

export const BALANCES = [
  { memberId: 'm-aarav', netMinor: 40000 },
  { memberId: 'm-riya', netMinor: 40000 },
  { memberId: 'm-kunal', netMinor: -80000 },
];

export function mockMoney({
  me,
  members = [aarav, riya, kunal],
  balances = BALANCES,
  expenses = [],
  settlements = [],
}: {
  me?: Parameters<typeof mockApi>[0] extends infer T ? (T extends { me?: infer M } ? M : never) : never;
  members?: households.Member[];
  balances?: expensesApi.BalanceRow[];
  expenses?: expensesApi.Expense[];
  settlements?: settlementsApi.Settlement[];
} = {}) {
  mockApi({ me: me ?? undefined, members });
  vi.mocked(households.listAllMembers).mockResolvedValue(members as households.MemberWithLeft[]);
  vi.mocked(expensesApi.getBalances).mockResolvedValue(balances);
  vi.mocked(expensesApi.listExpenses).mockResolvedValue({ items: expenses, hasMore: false });
  vi.mocked(expensesApi.getBalanceInputs).mockResolvedValue({ expenses: [], settlements: [], truncated: false });
  vi.mocked(expensesApi.listExpenseHistory).mockResolvedValue([]);
  vi.mocked(settlementsApi.listSettlements).mockResolvedValue(settlements);
}
