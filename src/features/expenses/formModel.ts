import { copy } from '@/copy';
import { buildShares, currencyDigits, formatPercentBp, minorToInput, parseAmount, parsePercentBp, type SplitMethod, type SplitResult } from '@/domain';
import type { Expense, ExpenseInput } from '@/api/expenses';

/**
 * Pure model for the add/edit expense form: the split preview, validation, and the payload sent to
 * the database. No React here, so every rule (including the ₹1,000-between-three vector) is
 * unit-tested directly. The database validates the same invariants again (PLAN D4).
 */
export interface ExpenseFormState {
  title: string;
  /** Integer minor units, or null when empty/invalid. */
  amountMinor: number | null;
  date: string;
  category: string;
  paidBy: string;
  /** Participant member ids. */
  selected: string[];
  method: SplitMethod;
  customRaw: Record<string, string>;
  percentRaw: Record<string, string>;
  notes: string;
}

/** Share amounts may be zero (a participant who owes nothing), unlike totals which must be positive. */
export function parseShareAmount(raw: string, digits: number): number | null {
  if (raw.trim() === '') return 0;
  const n = parseAmount(raw, digits);
  if (n !== null) return n;
  return /^0+(?:\.0*)?$/.test(raw.trim().replace(/,/g, '')) ? 0 : null;
}

export interface SplitPreview {
  /** null when the split cannot be computed yet (no amount, nobody selected, bad text). */
  result: SplitResult | null;
  /** True when some per-person text is not a valid number. */
  badInput: boolean;
  /** Member ids with unparseable text, so the UI can flag the field. */
  badMembers: string[];
}

/**
 * Computes the live preview. `memberOrder` fixes who receives rounding remainders (earlier members
 * first), so the same inputs always give the same shares.
 */
export function computeSplit(state: ExpenseFormState, memberOrder: string[], currency: string): SplitPreview {
  const total = state.amountMinor;
  const ordered = memberOrder.filter((id) => state.selected.includes(id));
  if (total === null || ordered.length === 0) return { result: null, badInput: false, badMembers: [] };
  const digits = currencyDigits(currency);

  if (state.method === 'equal') {
    return { result: buildShares(total, { method: 'equal', memberIds: ordered }), badInput: false, badMembers: [] };
  }

  if (state.method === 'custom') {
    const parsed = ordered.map((id) => ({ id, minor: parseShareAmount(state.customRaw[id] ?? '', digits) }));
    const bad = parsed.filter((p) => p.minor === null).map((p) => p.id);
    if (bad.length > 0) return { result: null, badInput: true, badMembers: bad };
    return {
      result: buildShares(total, { method: 'custom', amounts: parsed.map((p) => ({ memberId: p.id, amountMinor: p.minor! })) }),
      badInput: false,
      badMembers: [],
    };
  }

  const parsed = ordered.map((id) => {
    const raw = state.percentRaw[id] ?? '';
    return { id, bp: raw.trim() === '' ? 0 : parsePercentBp(raw) };
  });
  const bad = parsed.filter((p) => p.bp === null).map((p) => p.id);
  if (bad.length > 0) return { result: null, badInput: true, badMembers: bad };
  return {
    result: buildShares(total, { method: 'percentage', percents: parsed.map((p) => ({ memberId: p.id, bp: p.bp! })) }),
    badInput: false,
    badMembers: [],
  };
}

export type Problem = 'title' | 'amount' | 'people' | 'split';

export interface FormCheck {
  ok: boolean;
  /** First thing blocking save, as user-facing text (the reason the Save button gives when disabled). */
  reason: string | null;
  problem: Problem | null;
  input: ExpenseInput | null;
}

/** Validates the whole form and builds the payload for `add_expense` / `edit_expense`. */
export function checkForm(state: ExpenseFormState, memberOrder: string[], currency: string): FormCheck {
  const fail = (problem: Problem, reason: string): FormCheck => ({ ok: false, reason, problem, input: null });
  const title = state.title.trim();
  if (title.length === 0) return fail('title', copy.expenseForm.reasonTitle);
  if (title.length > 120) return fail('title', copy.expenseForm.titleTooLong);
  if (state.amountMinor === null) return fail('amount', copy.expenseForm.reasonAmount);
  if (state.selected.length === 0) return fail('people', copy.expenseForm.reasonPeople);
  const preview = computeSplit(state, memberOrder, currency);
  if (!preview.result?.ok) return fail('split', copy.expenseForm.reasonSplit);

  const bpByMember = new Map<string, number>();
  if (state.method === 'percentage') {
    for (const id of state.selected) bpByMember.set(id, parsePercentBp(state.percentRaw[id] ?? '') ?? 0);
  }
  return {
    ok: true,
    reason: null,
    problem: null,
    input: {
      title,
      amountMinor: state.amountMinor,
      category: state.category,
      paidByMemberId: state.paidBy,
      expenseDate: state.date,
      splitMethod: state.method,
      notes: state.notes.trim() === '' ? null : state.notes.trim(),
      shares: preview.result.shares.map((s) => ({
        memberId: s.memberId,
        amountMinor: s.amountMinor,
        ...(state.method === 'percentage' ? { percentBp: bpByMember.get(s.memberId) ?? 0 } : {}),
      })),
    },
  };
}

/** Rebuilds the form from a saved expense (edit mode). */
export function stateFromExpense(e: Expense, currency: string): ExpenseFormState {
  const digits = currencyDigits(currency);
  return {
    title: e.title,
    amountMinor: e.amountMinor,
    date: e.expenseDate,
    category: e.category,
    paidBy: e.paidByMemberId,
    selected: e.shares.map((s) => s.memberId),
    method: e.splitMethod,
    customRaw: Object.fromEntries(e.shares.map((s) => [s.memberId, minorToInput(s.shareAmountMinor, digits)])),
    percentRaw: Object.fromEntries(e.shares.map((s) => [s.memberId, s.percentBp === null ? '' : formatPercentBp(s.percentBp)])),
    notes: e.notes ?? '',
  };
}

/** Canonical payload of a saved expense, to detect "nothing changed" in edit mode. */
export function inputFromExpense(e: Expense): ExpenseInput {
  return {
    title: e.title,
    amountMinor: e.amountMinor,
    category: e.category,
    paidByMemberId: e.paidByMemberId,
    expenseDate: e.expenseDate,
    splitMethod: e.splitMethod,
    notes: e.notes,
    shares: [...e.shares]
      .map((s) => ({ memberId: s.memberId, amountMinor: s.shareAmountMinor, ...(e.splitMethod === 'percentage' ? { percentBp: s.percentBp ?? 0 } : {}) })),
  };
}

const canon = (i: ExpenseInput) =>
  JSON.stringify({ ...i, notes: i.notes ?? null, shares: [...i.shares].sort((a, b) => a.memberId.localeCompare(b.memberId)) });

export const sameInput = (a: ExpenseInput, b: ExpenseInput): boolean => canon(a) === canon(b);

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
