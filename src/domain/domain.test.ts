/**
 * Shared test vectors. The same vectors must appear in the pgTAP files (PLAN §10 parity rule).
 * Extend, never weaken.
 */
import { describe, expect, it } from 'vitest';
import {
  categoryEnabled,
  categoryOf,
  inQuietHours,
  unreadCount,
  visibleEvents,
  addDays, addMonths, buildShares, computeBalances, equalShares, explainBalance, formatMoney,
  inviteState, isIsoDate, isValidInviteFormat, minorToInput, nextAssignee, nextOccurrence,
  choreBucket, daysBetween, dueInfo, findDuplicate, normalizeItemName,
  normalizeInviteCode, parseAmount, parsePercentBp, formatPercentBp, percentageShares, pruneRotation, suggestTransfers,
} from './index';
import type { ExpenseRecord, SettlementRecord } from './types';

const sum = (xs: { amountMinor: number }[]) => xs.reduce((s, x) => s + x.amountMinor, 0);

describe('money', () => {
  it.each([
    ['1000', 100000], ['1,000.50', 100050], ['0.01', 1], ['  12.5 ', 1250], ['100000000', 10_000_000_000],
  ])('parses %s', (input, minor) => expect(parseAmount(input)).toBe(minor));

  it.each(['', 'abc', '0', '0.00', '-5', '1.234', '1e3', '100000000.01', '1.2.3', '.5'])('rejects %j', (input) =>
    expect(parseAmount(input)).toBeNull());

  it('supports zero-decimal currencies', () => {
    expect(parseAmount('500', 0)).toBe(500);
    expect(parseAmount('5.5', 0)).toBeNull();
  });

  it('round-trips minor units to input text', () => {
    expect(minorToInput(100050)).toBe('1000.50');
    expect(minorToInput(5)).toBe('0.05');
    expect(minorToInput(-250)).toBe('-2.50');
    for (const m of [1, 99, 100, 123456789]) expect(parseAmount(minorToInput(m))).toBe(m);
  });

  it('formats for display', () => {
    expect(formatMoney(100050, 'USD', 'en-US')).toBe('$1,000.50');
  });
});

describe('equal split', () => {
  it('₹1,000 across three people → 333.34 / 333.33 / 333.33', () => {
    const shares = equalShares(100000, ['a', 'b', 'c']);
    expect(shares.map((s) => s.amountMinor)).toEqual([33334, 33333, 33333]);
    expect(sum(shares)).toBe(100000);
  });
  it('divides evenly with no remainder', () => {
    expect(equalShares(900, ['a', 'b', 'c']).map((s) => s.amountMinor)).toEqual([300, 300, 300]);
  });
  it('spread is never more than 1 minor unit and sums exactly', () => {
    for (let total = 1; total < 60; total++) for (let n = 1; n <= 7; n++) {
      const s = equalShares(total, Array.from({ length: n }, (_, i) => `m${i}`));
      const v = s.map((x) => x.amountMinor);
      expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(1);
      expect(sum(s)).toBe(total);
    }
  });
  it('handles 1 minor unit across 3 and no participants', () => {
    expect(equalShares(1, ['a', 'b', 'c']).map((s) => s.amountMinor)).toEqual([1, 0, 0]);
    expect(equalShares(100, [])).toEqual([]);
  });
});

describe('percentage split', () => {
  it('50/30/20 of 100000', () => {
    const s = percentageShares(100000, [{ memberId: 'a', bp: 5000 }, { memberId: 'b', bp: 3000 }, { memberId: 'c', bp: 2000 }]);
    expect(s.map((x) => x.amountMinor)).toEqual([50000, 30000, 20000]);
  });
  it('33.34/33.33/33.33% of 100 → leftover unit goes to the largest remainder', () => {
    const s = percentageShares(100, [{ memberId: 'a', bp: 3334 }, { memberId: 'b', bp: 3333 }, { memberId: 'c', bp: 3333 }]);
    expect(s.map((x) => x.amountMinor)).toEqual([34, 33, 33]);
  });
  it('ties on remainder go to the earlier member', () => {
    const s = percentageShares(1, [{ memberId: 'a', bp: 5000 }, { memberId: 'b', bp: 5000 }]);
    expect(s.map((x) => x.amountMinor)).toEqual([1, 0]);
  });
  it('always sums exactly to the total', () => {
    for (const total of [1, 7, 99, 1001, 99999]) {
      const s = percentageShares(total, [{ memberId: 'a', bp: 3333 }, { memberId: 'b', bp: 3333 }, { memberId: 'c', bp: 3334 }]);
      expect(sum(s)).toBe(total);
    }
  });
});

describe('buildShares validation', () => {
  it('custom must sum to total and reports the difference', () => {
    const r = buildShares(1000, { method: 'custom', amounts: [{ memberId: 'a', amountMinor: 600 }, { memberId: 'b', amountMinor: 300 }] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('sum_mismatch');
    expect(r.difference).toBe(100);
  });
  it('custom exact sum is ok; negative rejected', () => {
    expect(buildShares(1000, { method: 'custom', amounts: [{ memberId: 'a', amountMinor: 600 }, { memberId: 'b', amountMinor: 400 }] }).ok).toBe(true);
    expect(buildShares(1000, { method: 'custom', amounts: [{ memberId: 'a', amountMinor: 1100 }, { memberId: 'b', amountMinor: -100 }] }).error).toBe('negative_share');
  });
  it('percentage must total 10000bp', () => {
    const r = buildShares(1000, { method: 'percentage', percents: [{ memberId: 'a', bp: 5000 }, { memberId: 'b', bp: 4000 }] });
    expect(r.error).toBe('percent_total');
    expect(r.difference).toBe(1000);
  });
  it('rejects no participants and duplicates', () => {
    expect(buildShares(100, { method: 'equal', memberIds: [] }).error).toBe('no_participants');
    expect(buildShares(100, { method: 'equal', memberIds: ['a', 'a'] }).error).toBe('duplicate_member');
  });
  it('names who received the rounding unit', () => {
    expect(buildShares(100000, { method: 'equal', memberIds: ['a', 'b', 'c'] }).roundingRecipients).toEqual(['a']);
    expect(buildShares(900, { method: 'equal', memberIds: ['a', 'b', 'c'] }).roundingRecipients).toEqual([]);
  });
});

describe('balances', () => {
  const expenses: ExpenseRecord[] = [
    { id: 'e1', title: 'Rent', amountMinor: 90000, paidBy: 'a', shares: [{ memberId: 'a', amountMinor: 30000 }, { memberId: 'b', amountMinor: 30000 }, { memberId: 'c', amountMinor: 30000 }] },
    { id: 'e2', title: 'Wifi', amountMinor: 10000, paidBy: 'b', shares: [{ memberId: 'a', amountMinor: 5000 }, { memberId: 'b', amountMinor: 5000 }] },
  ];
  const members = ['a', 'b', 'c'];

  it('credits payer, charges shares, nets to zero', () => {
    const b = computeBalances(members, expenses, []);
    expect(b).toEqual({ a: 60000 - 5000, b: -30000 + 10000 - 5000, c: -30000 });
    expect(Object.values(b).reduce((s, v) => s + v, 0)).toBe(0);
  });
  it('excludes deleted expenses', () => {
    const b = computeBalances(members, [expenses[0]!, { ...expenses[1]!, deleted: true }], []);
    expect(b).toEqual({ a: 60000, b: -30000, c: -30000 });
  });
  it('settlement from A to B credits A and debits B; only recorded counts', () => {
    const s: SettlementRecord[] = [
      { id: 's1', from: 'c', to: 'a', amountMinor: 10000, status: 'recorded' },
      { id: 's2', from: 'c', to: 'a', amountMinor: 5000, status: 'disputed' },
      { id: 's3', from: 'c', to: 'a', amountMinor: 7000, status: 'reversed' },
    ];
    const b = computeBalances(members, expenses, s);
    expect(b.c).toBe(-30000 + 10000);
    expect(b.a).toBe(55000 - 10000);
    expect(Object.values(b).reduce((x, v) => x + v, 0)).toBe(0);
  });
  it('explainBalance lines sum to the net', () => {
    const s: SettlementRecord[] = [{ id: 's1', from: 'c', to: 'a', amountMinor: 10000, status: 'recorded' }];
    const b = computeBalances(members, expenses, s);
    for (const m of members) {
      const total = explainBalance(m, expenses, s).reduce((x, l) => x + l.amountMinor, 0);
      expect(total).toBe(b[m]);
    }
  });
  it('suggested transfers settle everyone and preserve the total', () => {
    const b = computeBalances(members, expenses, []);
    const t = suggestTransfers(b);
    const after = { ...b };
    for (const x of t) { after[x.from] = (after[x.from] ?? 0) + x.amountMinor; after[x.to] = (after[x.to] ?? 0) - x.amountMinor; }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
  it('suggestions are deterministic and empty when settled', () => {
    expect(suggestTransfers({ a: 0, b: 0 })).toEqual([]);
    const b = { a: 500, b: -300, c: -200 };
    expect(suggestTransfers(b)).toEqual([{ from: 'b', to: 'a', amountMinor: 300 }, { from: 'c', to: 'a', amountMinor: 200 }]);
  });
});

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('26-1-1')).toBe(false);
  });
  it('adds days and clamps months', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('rotation', () => {
  it('nextOccurrence steps by frequency', () => {
    expect(nextOccurrence('2026-03-01', 'daily', '2026-03-01')).toBe('2026-03-02');
    expect(nextOccurrence('2026-03-01', 'weekly', '2026-03-01')).toBe('2026-03-08');
    expect(nextOccurrence('2026-03-01', 'biweekly', '2026-03-01')).toBe('2026-03-15');
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28');
  });
  it('is never in the past', () => {
    expect(nextOccurrence('2026-03-01', 'weekly', '2026-03-20')).toBe('2026-03-22');
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-04-10')).toBe('2026-04-30');
  });
  it('rotates through active members and wraps', () => {
    const active = new Set(['a', 'b', 'c']);
    expect(nextAssignee(['a', 'b', 'c'], 'a', active).assignee).toBe('b');
    expect(nextAssignee(['a', 'b', 'c'], 'c', active).assignee).toBe('a');
    expect(nextAssignee(['a', 'b', 'c'], null, active).assignee).toBe('a');
  });
  it('skips inactive members and reports them', () => {
    const r = nextAssignee(['a', 'b', 'c'], 'a', new Set(['a', 'c']));
    expect(r).toEqual({ assignee: 'c', skipped: ['b'] });
  });
  it('returns null when nobody is active; unknown current starts at first', () => {
    expect(nextAssignee(['a', 'b'], 'a', new Set()).assignee).toBeNull();
    expect(nextAssignee([], null, new Set(['a'])).assignee).toBeNull();
    expect(nextAssignee(['a', 'b'], 'zz', new Set(['a', 'b'])).assignee).toBe('a');
  });
  it('can return the same member when they are the only active one', () => {
    expect(nextAssignee(['a', 'b'], 'a', new Set(['a'])).assignee).toBe('a');
  });
  it('prunes departed members; fewer than 2 becomes null', () => {
    expect(pruneRotation(['a', 'b', 'c'], new Set(['a', 'c']))).toEqual(['a', 'c']);
    expect(pruneRotation(['a', 'b', 'c'], new Set(['a']))).toBeNull();
  });
});

describe('invites', () => {
  it('normalises pasted codes', () => {
    expect(normalizeInviteCode(' abcd-2345 ')).toBe('ABCD2345');
  });
  it('validates format (no 0/O/1/I/L)', () => {
    expect(isValidInviteFormat('abcd-2345')).toBe(true);
    expect(isValidInviteFormat('ABCD2340')).toBe(false);
    expect(isValidInviteFormat('ABC')).toBe(false);
  });
  it('evaluates state in priority order', () => {
    const base = { status: 'active' as const, expiresAt: '2026-06-01T00:00:00Z', maxUses: 2, useCount: 0 };
    const now = '2026-05-01T00:00:00Z';
    expect(inviteState(base, now)).toBe('ok');
    expect(inviteState({ ...base, status: 'revoked' }, now)).toBe('revoked');
    expect(inviteState(base, '2026-06-02T00:00:00Z')).toBe('expired');
    expect(inviteState({ ...base, useCount: 2 }, now)).toBe('used_up');
    expect(inviteState({ ...base, maxUses: null, useCount: 99 }, now)).toBe('ok');
  });
});

describe('percentages in basis points', () => {
  it.each([
    ['50', 5000], ['33.34', 3334], ['33.3', 3330], ['0', 0], ['100', 10000], ['0.01', 1], [' 12.5 % ', 1250], ['7.', 700],
  ])('parses %j as %i bp', (input, bp) => expect(parsePercentBp(input)).toBe(bp));

  it.each(['', 'abc', '-5', '100.01', '101', '1.234', '1e2', '.5', '1,5'])('rejects %j', (input) =>
    expect(parsePercentBp(input)).toBeNull());

  it('formats without trailing zeros and round-trips', () => {
    expect(formatPercentBp(3334)).toBe('33.34');
    expect(formatPercentBp(5000)).toBe('50');
    expect(formatPercentBp(3330)).toBe('33.3');
    expect(formatPercentBp(1)).toBe('0.01');
    for (const bp of [0, 1, 99, 100, 3333, 3334, 10000]) expect(parsePercentBp(formatPercentBp(bp))).toBe(bp);
  });
});

describe('chore buckets and due labels', () => {
  const today = '2026-03-10';
  it('today holds due-today and overdue chores; upcoming holds future and undated', () => {
    expect(choreBucket('2026-03-10', today)).toBe('today');
    expect(choreBucket('2026-03-01', today)).toBe('today');
    expect(choreBucket('2026-03-11', today)).toBe('upcoming');
    expect(choreBucket(null, today)).toBe('upcoming');
  });
  it('counts calendar days across month and year ends', () => {
    expect(daysBetween('2026-03-10', '2026-03-10')).toBe(0);
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2026-03-12', '2026-03-10')).toBe(-2);
  });
  it('classifies the due date', () => {
    expect(dueInfo(null, today)).toEqual({ kind: 'none', days: null });
    expect(dueInfo('2026-03-08', today)).toEqual({ kind: 'overdue', days: -2 });
    expect(dueInfo('2026-03-10', today)).toEqual({ kind: 'today', days: 0 });
    expect(dueInfo('2026-03-11', today)).toEqual({ kind: 'tomorrow', days: 1 });
    expect(dueInfo('2026-03-17', today)).toEqual({ kind: 'soon', days: 7 });
    expect(dueInfo('2026-03-18', today)).toEqual({ kind: 'later', days: 8 });
  });
});

describe('grocery duplicate detection', () => {
  const needed = [{ id: 'a', name: 'Whole Milk' }, { id: 'b', name: 'Eggs' }];
  it('normalises case and spacing', () => {
    expect(normalizeItemName('  Whole   MILK ')).toBe('whole milk');
  });
  it('finds the same item regardless of case/spaces', () => {
    expect(findDuplicate(needed, ' whole  milk')?.id).toBe('a');
    expect(findDuplicate(needed, 'EGGS')?.id).toBe('b');
  });
  it('does not match different items, partial names, or blanks', () => {
    expect(findDuplicate(needed, 'Milk')).toBeUndefined();
    expect(findDuplicate(needed, 'Egg')).toBeUndefined();
    expect(findDuplicate(needed, '   ')).toBeUndefined();
  });
  it('an item being edited ignores itself', () => {
    expect(findDuplicate(needed, 'Eggs', 'b')).toBeUndefined();
    expect(findDuplicate(needed, 'Eggs', 'a')?.id).toBe('b');
  });
});

describe('notifications', () => {
  const ev = (id: string, type: string, rec: string[], at: string) => ({ id, eventType: type, actorMemberId: null, recipientMemberIds: rec, createdAt: at });
  const events = [
    ev('1', 'expense.added', ['me'], '2026-05-01T10:00:00Z'),
    ev('2', 'chore.assigned', ['me', 'x'], '2026-05-02T10:00:00Z'),
    ev('3', 'grocery.added', ['x'], '2026-05-03T10:00:00Z'),
    ev('4', 'announcement.posted', ['me'], '2026-05-04T10:00:00Z'),
    ev('5', 'member.joined', ['me'], '2026-05-05T10:00:00Z'),
  ];
  const quietOff = { quietEnabled: false, quietStart: null, quietEnd: null };

  it.each([
    ['expense.added', 'expenses'],
    ['expense.restored', 'expenses'],
    ['settlement.recorded', 'settlements'],
    ['chore.reminder', 'chores'],
    ['grocery.purchased', 'groceries'],
    ['announcement.pinned', 'announcements'],
    ['member.left', 'household'],
    ['household.archived', 'household'],
    ['something.new', 'household'],
  ])('%s is in %s', (type, cat) => expect(categoryOf(type)).toBe(cat));

  it('shows only events addressed to me, newest first', () => {
    expect(visibleEvents(events, 'me', {}).map((e) => e.id)).toEqual(['5', '4', '2', '1']);
  });

  it('a switched-off category disappears; a missing key means on', () => {
    expect(visibleEvents(events, 'me', { chores: false, household: false }).map((e) => e.id)).toEqual(['4', '1']);
    expect(categoryEnabled({}, 'expenses')).toBe(true);
    expect(categoryEnabled({ expenses: false }, 'expenses')).toBe(false);
  });

  it('counts unread, ignoring read and hidden events', () => {
    expect(unreadCount(events, 'me', new Set(), {}, quietOff, 600)).toBe(4);
    expect(unreadCount(events, 'me', new Set(['5', '1']), {}, quietOff, 600)).toBe(2);
    expect(unreadCount(events, 'me', new Set(), { announcements: false }, quietOff, 600)).toBe(3);
  });

  it.each([
    [22 * 60, true], [23 * 60 + 59, true], [0, true], [6 * 60 + 59, true],
    [7 * 60, false], [12 * 60, false], [21 * 60 + 59, false],
  ])('overnight window 22:00–07:00 at minute %i → %s', (m, expected) => expect(inQuietHours(m, '22:00', '07:00')).toBe(expected));

  it('same-day window, seconds in the stored time, and empty windows', () => {
    expect(inQuietHours(13 * 60, '13:00:00', '15:00:00')).toBe(true);
    expect(inQuietHours(15 * 60, '13:00:00', '15:00:00')).toBe(false);
    expect(inQuietHours(600, '09:00', '09:00')).toBe(false);
    expect(inQuietHours(600, null, '09:00')).toBe(false);
  });

  it('quiet hours pause the badge only, and only when enabled', () => {
    const quiet = { quietEnabled: true, quietStart: '22:00', quietEnd: '07:00' };
    expect(unreadCount(events, 'me', new Set(), {}, quiet, 23 * 60)).toBe(0);
    expect(unreadCount(events, 'me', new Set(), {}, quiet, 12 * 60)).toBe(4);
    expect(unreadCount(events, 'me', new Set(), {}, { ...quiet, quietEnabled: false }, 23 * 60)).toBe(4);
    expect(visibleEvents(events, 'me', {})).toHaveLength(4); // still listed
  });
});

describe('notifications: edge cases', () => {
  const quietOff = { quietEnabled: false, quietStart: null, quietEnd: null };

  it('no events, or none addressed to me, means zero unread and an empty list', () => {
    expect(unreadCount([], 'me', new Set(), {}, quietOff, 0)).toBe(0);
    const other = [{ id: '1', eventType: 'expense.added', actorMemberId: null, recipientMemberIds: ['x'], createdAt: '2026-05-01T10:00:00Z' }];
    expect(visibleEvents(other, 'me', {})).toEqual([]);
    expect(visibleEvents(other, '', {})).toEqual([]);
  });

  it('every category switched off hides everything', () => {
    const all = { expenses: false, settlements: false, chores: false, groceries: false, announcements: false, household: false };
    const events = ['expense.added', 'chore.reminder', 'member.joined'].map((t, i) => ({ id: String(i), eventType: t, actorMemberId: null, recipientMemberIds: ['me'], createdAt: '2026-05-01T10:00:00Z' }));
    expect(visibleEvents(events, 'me', all)).toEqual([]);
    expect(unreadCount(events, 'me', new Set(), all, quietOff, 0)).toBe(0);
  });

  it('same-timestamp events keep a stable order', () => {
    const mk = (id: string) => ({ id, eventType: 'chore.assigned', actorMemberId: null, recipientMemberIds: ['me'], createdAt: '2026-05-01T10:00:00Z' });
    expect(visibleEvents([mk('a'), mk('b')], 'me', {}).map((e) => e.id)).toEqual(['b', 'a']);
    expect(visibleEvents([mk('b'), mk('a')], 'me', {}).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it.each([
    [23 * 60 + 59, '23:59', '00:01', true],
    [0, '23:59', '00:01', true],
    [1, '23:59', '00:01', false],
    [0, '00:00', '23:59', true],
    [23 * 60 + 59, '00:00', '23:59', false],
    [12 * 60, '12:00', '12:01', true],
    [12 * 60 + 1, '12:00', '12:01', false],
  ])('quiet window boundaries: minute %i in %s–%s → %s', (m, s, e, expected) => expect(inQuietHours(m, s, e)).toBe(expected));

  it('an unknown or empty event type is still shown under household', () => {
    expect(categoryOf('')).toBe('household');
    expect(categoryOf('.')).toBe('household');
  });
});
