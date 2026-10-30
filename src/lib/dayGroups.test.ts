import { describe, expect, it } from 'vitest';
import { dayLabel, groupByDay } from './dayGroups';

const now = new Date(2026, 5, 10, 15, 0);
const at = (day: number, h: number) => new Date(2026, 5, day, h).toISOString();

describe('day groups', () => {
  it('labels today, yesterday and older days', () => {
    expect(dayLabel(at(10, 1), now)).toBe('Today');
    expect(dayLabel(at(9, 23), now)).toBe('Yesterday');
    expect(dayLabel(at(7, 9), now, 'en-GB')).toBe('07 Jun 2026');
  });
  it('groups newest-first events under one label per day', () => {
    const g = groupByDay([{ createdAt: at(10, 14) }, { createdAt: at(10, 9) }, { createdAt: at(9, 20) }, { createdAt: at(7, 8) }], now, 'en-GB');
    expect(g.map((x) => [x.label, x.events.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
      ['07 Jun 2026', 1],
    ]);
  });
  it('is empty for no events', () => expect(groupByDay([], now)).toEqual([]));
});
