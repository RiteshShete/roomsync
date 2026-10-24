import type { MemberId, Share, SplitMethod } from './types';

export const TOTAL_BP = 10_000;

/** Equal split. Remainder goes one minor unit at a time to the first members, in the given order. */
export function equalShares(totalMinor: number, memberIds: MemberId[]): Share[] {
  const n = memberIds.length;
  if (n === 0) return [];
  const base = Math.floor(totalMinor / n);
  const extra = totalMinor - base * n;
  return memberIds.map((memberId, i) => ({ memberId, amountMinor: base + (i < extra ? 1 : 0) }));
}

/**
 * Percentage split in basis points (1% = 100bp). Shares are floored, then leftover minor units
 * go to the largest fractional remainders (ties: earlier member first). Sums exactly to total.
 */
export function percentageShares(
  totalMinor: number,
  entries: { memberId: MemberId; bp: number }[],
): Share[] {
  const rows = entries.map((e, i) => {
    const product = totalMinor * e.bp;
    return { i, memberId: e.memberId, floor: Math.floor(product / TOTAL_BP), rem: product % TOTAL_BP };
  });
  let left = totalMinor - rows.reduce((s, r) => s + r.floor, 0);
  const order = [...rows].sort((a, b) => b.rem - a.rem || a.i - b.i);
  const bump = new Set<number>();
  for (const r of order) {
    if (left <= 0) break;
    bump.add(r.i);
    left--;
  }
  return rows.map((r) => ({ memberId: r.memberId, amountMinor: r.floor + (bump.has(r.i) ? 1 : 0) }));
}

export type SplitInput =
  | { method: 'equal'; memberIds: MemberId[] }
  | { method: 'custom'; amounts: { memberId: MemberId; amountMinor: number }[] }
  | { method: 'percentage'; percents: { memberId: MemberId; bp: number }[] };

export type SplitError = 'no_participants' | 'negative_share' | 'sum_mismatch' | 'percent_total' | 'duplicate_member';

export interface SplitResult {
  ok: boolean;
  shares: Share[];
  /** total - sum(shares) for custom; TOTAL_BP - sum(bp) for percentage; 0 otherwise. */
  difference: number;
  error?: SplitError;
  /** Members who received one extra minor unit from rounding (equal/percentage). */
  roundingRecipients: MemberId[];
}

function ids(input: SplitInput): MemberId[] {
  switch (input.method) {
    case 'equal': return input.memberIds;
    case 'custom': return input.amounts.map((a) => a.memberId);
    case 'percentage': return input.percents.map((p) => p.memberId);
  }
}

export function buildShares(totalMinor: number, input: SplitInput): SplitResult {
  const members = ids(input);
  const fail = (error: SplitError, difference = 0, shares: Share[] = []): SplitResult =>
    ({ ok: false, shares, difference, error, roundingRecipients: [] });

  if (members.length === 0) return fail('no_participants');
  if (new Set(members).size !== members.length) return fail('duplicate_member');

  if (input.method === 'equal') {
    const shares = equalShares(totalMinor, input.memberIds);
    const min = Math.min(...shares.map((s) => s.amountMinor));
    return { ok: true, shares, difference: 0, roundingRecipients: shares.filter((s) => s.amountMinor > min).map((s) => s.memberId) };
  }

  if (input.method === 'custom') {
    const shares = input.amounts.map((a) => ({ memberId: a.memberId, amountMinor: a.amountMinor }));
    if (shares.some((s) => s.amountMinor < 0 || !Number.isInteger(s.amountMinor))) return fail('negative_share', 0, shares);
    const difference = totalMinor - shares.reduce((s, x) => s + x.amountMinor, 0);
    return difference === 0
      ? { ok: true, shares, difference, roundingRecipients: [] }
      : fail('sum_mismatch', difference, shares);
  }

  const bpTotal = input.percents.reduce((s, p) => s + p.bp, 0);
  if (input.percents.some((p) => p.bp < 0 || !Number.isInteger(p.bp))) return fail('negative_share');
  if (bpTotal !== TOTAL_BP) return fail('percent_total', TOTAL_BP - bpTotal);
  const shares = percentageShares(totalMinor, input.percents);
  const exact = new Map(input.percents.map((p) => [p.memberId, p.bp]));
  const recipients = shares
    .filter((s) => s.amountMinor * TOTAL_BP > totalMinor * (exact.get(s.memberId) ?? 0))
    .map((s) => s.memberId);
  return { ok: true, shares, difference: 0, roundingRecipients: recipients };
}

export function isSplitMethod(v: string): v is SplitMethod {
  return v === 'equal' || v === 'custom' || v === 'percentage';
}

/**
 * Parse a percentage like "33.34" into basis points (1% = 100bp) using string math: up to two
 * decimals, 0..100 inclusive. Returns null when invalid.
 */
export function parsePercentBp(input: string): number | null {
  const cleaned = input.trim().replace(/%$/, '').trim();
  const m = /^(\d{1,3})(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return bp <= TOTAL_BP ? bp : null;
}

/** 3334 -> "33.34", 5000 -> "50", 100 -> "1". */
export function formatPercentBp(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}
