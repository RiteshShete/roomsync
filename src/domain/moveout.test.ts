import { describe, expect, it } from 'vitest';
import { checkMoveOutDate, latestMoveOutDate, moveOutTiming } from './moveout';

const TODAY = '2026-10-25';

describe('checkMoveOutDate (today through +90 days)', () => {
  it.each([
    ['2026-10-25', null],
    ['2026-10-26', null],
    ['2027-01-23', null], // exactly +90
    ['2027-01-24', 'tooFar'],
    ['2026-10-24', 'past'],
    ['2020-01-01', 'past'],
    ['', 'missing'],
    ['25/10/2026', 'invalid'],
    ['2026-02-30', 'invalid'],
  ])('%s → %s', (date, problem) => expect(checkMoveOutDate(date, TODAY)).toBe(problem));

  it('crosses month and year ends and a leap day correctly', () => {
    expect(latestMoveOutDate('2026-10-25')).toBe('2027-01-23');
    expect(latestMoveOutDate('2027-12-31')).toBe('2028-03-30');
    expect(latestMoveOutDate('2028-01-01')).toBe('2028-03-31'); // 2028 is a leap year
    expect(checkMoveOutDate('2028-03-31', '2028-01-01')).toBeNull();
    expect(checkMoveOutDate('2028-04-01', '2028-01-01')).toBe('tooFar');
  });
});

describe('moveOutTiming', () => {
  it('phrases today, tomorrow, later and already-passed', () => {
    expect(moveOutTiming('2026-10-25', TODAY)).toEqual({ kind: 'today' });
    expect(moveOutTiming('2026-10-26', TODAY)).toEqual({ kind: 'tomorrow' });
    expect(moveOutTiming('2026-11-24', TODAY)).toEqual({ kind: 'inDays', days: 30 });
    expect(moveOutTiming('2026-10-24', TODAY)).toEqual({ kind: 'passed' });
  });
});
