import { describe, expect, it } from 'vitest';
import type { Expense } from '@/api/expenses';
import { copy } from '@/copy';
import { checkForm, computeSplit, inputFromExpense, parseShareAmount, sameInput, stateFromExpense, todayIso, type ExpenseFormState } from './formModel';

const ORDER = ['a', 'b', 'c', 'd'];

function state(overrides: Partial<ExpenseFormState> = {}): ExpenseFormState {
  return {
    title: 'Rent',
    amountMinor: 100000,
    date: '2026-05-01',
    category: 'rent',
    paidBy: 'a',
    selected: ['a', 'b', 'c'],
    method: 'equal',
    customRaw: {},
    percentRaw: {},
    notes: '',
    ...overrides,
  };
}

const amounts = (s: ExpenseFormState) => computeSplit(s, ORDER, 'INR').result?.shares.map((x) => x.amountMinor);

describe('equal split preview', () => {
  it('₹1,000 across three people → 333.34 / 333.33 / 333.33 (manual scenario 2)', () => {
    expect(amounts(state())).toEqual([33334, 33333, 33333]);
  });

  it('names who got the extra unit, in stable member order regardless of click order', () => {
    const r = computeSplit(state({ selected: ['c', 'a', 'b'] }), ORDER, 'INR').result!;
    expect(r.roundingRecipients).toEqual(['a']);
    expect(r.shares.map((s) => s.memberId)).toEqual(['a', 'b', 'c']);
  });

  it('divides evenly with no rounding note', () => {
    const r = computeSplit(state({ amountMinor: 90000 }), ORDER, 'INR').result!;
    expect(r.shares.map((s) => s.amountMinor)).toEqual([30000, 30000, 30000]);
    expect(r.roundingRecipients).toEqual([]);
  });

  it('is empty until there is an amount and a participant', () => {
    expect(computeSplit(state({ amountMinor: null }), ORDER, 'INR').result).toBeNull();
    expect(computeSplit(state({ selected: [] }), ORDER, 'INR').result).toBeNull();
  });

  it('a single participant bears everything', () => {
    expect(amounts(state({ selected: ['b'], amountMinor: 12345 }))).toEqual([12345]);
  });
});

describe('custom split preview', () => {
  it('accepts shares that add up exactly', () => {
    const s = state({ method: 'custom', amountMinor: 1000, selected: ['a', 'b'], customRaw: { a: '6', b: '4' } });
    const p = computeSplit(s, ORDER, 'INR');
    expect(p.result?.ok).toBe(true);
    expect(p.result?.shares.map((x) => x.amountMinor)).toEqual([600, 400]);
  });

  it('reports what is left to assign, and when it is too much', () => {
    const left = computeSplit(state({ method: 'custom', amountMinor: 1000, selected: ['a', 'b'], customRaw: { a: '6', b: '3' } }), ORDER, 'INR').result!;
    expect(left.ok).toBe(false);
    expect(left.difference).toBe(100);
    const over = computeSplit(state({ method: 'custom', amountMinor: 1000, selected: ['a', 'b'], customRaw: { a: '6', b: '5' } }), ORDER, 'INR').result!;
    expect(over.difference).toBe(-100);
  });

  it('an empty box counts as zero; text that is not a number is flagged by member', () => {
    const empty = computeSplit(state({ method: 'custom', amountMinor: 1000, selected: ['a', 'b'], customRaw: { a: '10' } }), ORDER, 'INR');
    expect(empty.result?.ok).toBe(true);
    const bad = computeSplit(state({ method: 'custom', amountMinor: 1000, selected: ['a', 'b'], customRaw: { a: '10', b: 'abc' } }), ORDER, 'INR');
    expect(bad.result).toBeNull();
    expect(bad.badInput).toBe(true);
    expect(bad.badMembers).toEqual(['b']);
  });

  it('never accepts a negative share', () => {
    const p = computeSplit(state({ method: 'custom', amountMinor: 1000, selected: ['a', 'b'], customRaw: { a: '15', b: '-5' } }), ORDER, 'INR');
    expect(p.badInput).toBe(true);
  });
});

describe('percentage split preview', () => {
  it('50/30/20 of ₹1,000', () => {
    const s = state({ method: 'percentage', percentRaw: { a: '50', b: '30', c: '20' } });
    expect(amounts(s)).toEqual([50000, 30000, 20000]);
  });

  it('33.34 / 33.33 / 33.33 splits ₹1,000 exactly with the leftover to the largest remainder', () => {
    const s = state({ method: 'percentage', percentRaw: { a: '33.34', b: '33.33', c: '33.33' } });
    const r = computeSplit(s, ORDER, 'INR').result!;
    expect(r.ok).toBe(true);
    expect(r.shares.reduce((t, x) => t + x.amountMinor, 0)).toBe(100000);
  });

  it('must total 100%, and reports how far off it is', () => {
    const r = computeSplit(state({ method: 'percentage', percentRaw: { a: '50', b: '30', c: '10' } }), ORDER, 'INR').result!;
    expect(r.ok).toBe(false);
    expect(r.difference).toBe(1000); // 10% still to assign
    const over = computeSplit(state({ method: 'percentage', percentRaw: { a: '60', b: '30', c: '20' } }), ORDER, 'INR').result!;
    expect(over.difference).toBe(-1000);
  });

  it('flags text that is not a percentage', () => {
    const p = computeSplit(state({ method: 'percentage', percentRaw: { a: '50', b: '30', c: '20.555' } }), ORDER, 'INR');
    expect(p.badInput).toBe(true);
    expect(p.badMembers).toEqual(['c']);
  });
});

describe('parseShareAmount', () => {
  it.each([['', 0], ['0', 0], ['0.00', 0], ['12.5', 1250], ['1,000', 100000]])('%j → %i', (raw, minor) =>
    expect(parseShareAmount(raw, 2)).toBe(minor));
  it.each(['abc', '-1', '1.234'])('rejects %j', (raw) => expect(parseShareAmount(raw, 2)).toBeNull());
});

describe('checkForm', () => {
  it('builds the payload sent to the database', () => {
    const c = checkForm(state({ title: '  Rent ', notes: ' May ' }), ORDER, 'INR');
    expect(c.ok).toBe(true);
    expect(c.input).toEqual({
      title: 'Rent',
      amountMinor: 100000,
      category: 'rent',
      paidByMemberId: 'a',
      expenseDate: '2026-05-01',
      splitMethod: 'equal',
      notes: 'May',
      shares: [
        { memberId: 'a', amountMinor: 33334 },
        { memberId: 'b', amountMinor: 33333 },
        { memberId: 'c', amountMinor: 33333 },
      ],
    });
  });

  it('percentage payloads carry basis points', () => {
    const c = checkForm(state({ method: 'percentage', percentRaw: { a: '50', b: '30', c: '20' } }), ORDER, 'INR');
    expect(c.input?.shares).toEqual([
      { memberId: 'a', amountMinor: 50000, percentBp: 5000 },
      { memberId: 'b', amountMinor: 30000, percentBp: 3000 },
      { memberId: 'c', amountMinor: 20000, percentBp: 2000 },
    ]);
  });

  it.each([
    [{ title: '   ' }, 'title', copy.expenseForm.reasonTitle],
    [{ title: 'x'.repeat(121) }, 'title', copy.expenseForm.titleTooLong],
    [{ amountMinor: null }, 'amount', copy.expenseForm.reasonAmount],
    [{ selected: [] }, 'people', copy.expenseForm.reasonPeople],
    [{ method: 'custom' as const, customRaw: { a: '1' } }, 'split', copy.expenseForm.reasonSplit],
  ])('blocks save for %j with a reason', (overrides, problem, reason) => {
    const c = checkForm(state(overrides), ORDER, 'INR');
    expect(c.ok).toBe(false);
    expect(c.problem).toBe(problem);
    expect(c.reason).toBe(reason);
    expect(c.input).toBeNull();
  });

  it('blank notes become null', () => {
    expect(checkForm(state({ notes: '   ' }), ORDER, 'INR').input?.notes).toBeNull();
  });
});

describe('edit mode round trip', () => {
  const expense: Expense = {
    id: 'e1',
    title: 'Wi-Fi',
    amountMinor: 99900,
    currencyCode: 'INR',
    category: 'internet',
    paidByMemberId: 'b',
    expenseDate: '2026-05-02',
    notes: null,
    splitMethod: 'percentage',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    deletedBy: null,
    version: 2,
    shares: [
      { memberId: 'a', shareAmountMinor: 49950, percentBp: 5000 },
      { memberId: 'b', shareAmountMinor: 49950, percentBp: 5000 },
    ],
  };

  it('prefills the form from a saved expense', () => {
    const s = stateFromExpense(expense, 'INR');
    expect(s.percentRaw).toEqual({ a: '50', b: '50' });
    expect(s.customRaw).toEqual({ a: '499.50', b: '499.50' });
    expect(s.selected).toEqual(['a', 'b']);
  });

  it('unchanged form produces the same payload as the saved expense (so Save can stay disabled)', () => {
    const c = checkForm(stateFromExpense(expense, 'INR'), ORDER, 'INR');
    expect(c.ok).toBe(true);
    expect(sameInput(c.input!, inputFromExpense(expense))).toBe(true);
  });

  it('a real change is detected', () => {
    const c = checkForm({ ...stateFromExpense(expense, 'INR'), title: 'Broadband' }, ORDER, 'INR');
    expect(sameInput(c.input!, inputFromExpense(expense))).toBe(false);
  });
});

it('todayIso gives local YYYY-MM-DD', () => {
  expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  expect(todayIso(new Date(2026, 11, 31))).toBe('2026-12-31');
});
