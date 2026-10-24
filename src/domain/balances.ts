import type { Balances, ExpenseRecord, MemberId, SettlementRecord, Transfer } from './types';

/**
 * Net balance model (PLAN D3, D8). Positive = is owed, negative = owes.
 * Expense: payer +amount, each participant -share. Deleted expenses excluded.
 * Settlement from A to B: A +amount, B -amount. Only `recorded` settlements count
 * (disputed and reversed are excluded).
 */
export function computeBalances(
  memberIds: MemberId[],
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[],
): Balances {
  const b: Balances = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const add = (id: MemberId, v: number) => { b[id] = (b[id] ?? 0) + v; };
  for (const e of expenses) {
    if (e.deleted) continue;
    add(e.paidBy, e.amountMinor);
    for (const s of e.shares) add(s.memberId, -s.amountMinor);
  }
  for (const s of settlements) {
    if (s.status !== 'recorded') continue;
    add(s.from, s.amountMinor);
    add(s.to, -s.amountMinor);
  }
  return b;
}

/**
 * Greedy, deterministic suggested transfers: largest debtor pays largest creditor.
 * Ties broken by member id. Labelled "Suggestion" in the UI; never executed.
 */
export function suggestTransfers(balances: Balances): Transfer[] {
  const debtors = Object.entries(balances).filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, left: -v })).sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  const creditors = Object.entries(balances).filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, left: v })).sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!, c = creditors[j]!;
    const amt = Math.min(d.left, c.left);
    if (amt > 0) out.push({ from: d.id, to: c.id, amountMinor: amt });
    d.left -= amt;
    c.left -= amt;
    if (d.left === 0) i++;
    if (c.left === 0) j++;
  }
  return out;
}

export interface BalanceLine {
  kind: 'paid' | 'share' | 'settlement_out' | 'settlement_in';
  refId: string;
  label?: string;
  /** Signed effect on the member's net balance. */
  amountMinor: number;
}

/** "Why do I owe this?" - lines whose amounts sum exactly to the member's net balance. */
export function explainBalance(
  memberId: MemberId,
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[],
): BalanceLine[] {
  const lines: BalanceLine[] = [];
  for (const e of expenses) {
    if (e.deleted) continue;
    if (e.paidBy === memberId) lines.push({ kind: 'paid', refId: e.id, label: e.title, amountMinor: e.amountMinor });
    const mine = e.shares.find((s) => s.memberId === memberId);
    if (mine && mine.amountMinor !== 0) lines.push({ kind: 'share', refId: e.id, label: e.title, amountMinor: -mine.amountMinor });
  }
  for (const s of settlements) {
    if (s.status !== 'recorded') continue;
    if (s.from === memberId) lines.push({ kind: 'settlement_out', refId: s.id, amountMinor: s.amountMinor });
    if (s.to === memberId) lines.push({ kind: 'settlement_in', refId: s.id, amountMinor: -s.amountMinor });
  }
  return lines;
}
