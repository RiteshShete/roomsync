import { describe, expect, it } from 'vitest';
import { expense } from '@/test/money';
import { shareExpensesText, sortExpenses, toPay, toReceive } from './tabsModel';

const share = (memberId: string, shareAmountMinor: number) => ({ memberId, shareAmountMinor, percentBp: null });
const mine = expense({ id: 'a', title: 'Mine', amountMinor: 3000, expenseDate: '2026-06-06', paidByMemberId: 'me', shares: [share('me', 1000), share('x', 2000)] });
const theirs = expense({ id: 'b', title: 'Theirs', amountMinor: 1500, expenseDate: '2026-06-12', paidByMemberId: 'x', shares: [share('me', 750), share('x', 750)] });
const notIn = expense({ id: 'c', title: 'NotIn', amountMinor: 900, expenseDate: '2026-06-20', paidByMemberId: 'x', shares: [share('x', 900)] });
const zero = expense({ id: 'd', title: 'Zero', paidByMemberId: 'x', shares: [share('me', 0), share('x', 500)] });
const gone = expense({ id: 'e', title: 'Gone', paidByMemberId: 'x', deletedAt: '2026-06-21T00:00:00Z', shares: [share('me', 100)] });
const all = [mine, theirs, notIn, zero, gone];

describe('To Pay / To Receive', () => {
  it('To Pay: others paid and I owe a share; To Receive: I paid and someone else owes', () => {
    expect(toPay(all, 'me').map((e) => e.id)).toEqual(['b']);
    expect(toReceive(all, 'me').map((e) => e.id)).toEqual(['a']);
  });
  it('an expense I paid for only myself is in neither', () => {
    const solo = expense({ paidByMemberId: 'me', shares: [share('me', 100)] });
    expect([...toPay([solo], 'me'), ...toReceive([solo], 'me')]).toEqual([]);
  });
  it('sorts by newest, oldest and amount', () => {
    expect(sortExpenses(all, 'newest').map((e) => e.id).slice(0, 3)).toEqual(['c', 'b', 'a']);
    expect(sortExpenses([mine, theirs, notIn], 'oldest').map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(sortExpenses([mine, theirs, notIn], 'amount').map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
  it('writes a shareable list', () => {
    expect(shareExpensesText('Expenses', [theirs], () => 'Tejas', (m) => `₹${m / 100}`)).toBe('Expenses\n- Theirs: ₹15 (paid by Tejas, 12 Jun 2026)');
  });
});
