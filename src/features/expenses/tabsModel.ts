import type { Expense } from '@/api/expenses';
import { formatDay } from '@/lib/format';

export type MoneyTab = 'pay' | 'receive';
export type ExpenseSort = 'newest' | 'oldest' | 'amount';

/** Expenses someone else paid where I owe a share. (Settlements are not netted off here; Balances does that.) */
export const toPay = (all: Expense[], me: string): Expense[] =>
  all.filter((e) => e.deletedAt === null && e.paidByMemberId !== me && e.shares.some((s) => s.memberId === me && s.shareAmountMinor > 0));

/** Expenses I paid where someone else owes a share. */
export const toReceive = (all: Expense[], me: string): Expense[] =>
  all.filter((e) => e.deletedAt === null && e.paidByMemberId === me && e.shares.some((s) => s.memberId !== me && s.shareAmountMinor > 0));

export function sortExpenses(list: Expense[], sort: ExpenseSort): Expense[] {
  const byDate = (a: Expense, b: Expense) => (a.expenseDate === b.expenseDate ? (a.createdAt < b.createdAt ? 1 : -1) : a.expenseDate < b.expenseDate ? 1 : -1);
  if (sort === 'amount') return [...list].sort((a, b) => b.amountMinor - a.amountMinor || byDate(a, b));
  return sort === 'oldest' ? [...list].sort((a, b) => -byDate(a, b)) : [...list].sort(byDate);
}

/** A plain-text copy of a list, for sharing. */
export function shareExpensesText(title: string, list: Expense[], nameOf: (id: string) => string, fmt: (minor: number) => string): string {
  return [title, ...list.map((e) => `- ${e.title}: ${fmt(e.amountMinor)} (paid by ${nameOf(e.paidByMemberId)}, ${formatDay(e.expenseDate)})`)].join('\n');
}
