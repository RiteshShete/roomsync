import { describe, expect, it } from 'vitest';
import { formatRelative } from './format';

const now = new Date('2026-06-10T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('formatRelative', () => {
  it('speaks in minutes, then hours', () => {
    expect(formatRelative(ago(20_000), now)).toBe('Just now');
    expect(formatRelative(ago(60_000), now)).toBe('1 min ago');
    expect(formatRelative(ago(10 * 60_000), now)).toBe('10 mins ago');
    expect(formatRelative(ago(60 * 60_000), now)).toBe('1 hour ago');
    expect(formatRelative(ago(5 * 3_600_000), now)).toBe('5 hours ago');
  });
  it('falls back to a short date after a day, and never goes negative for clock skew', () => {
    expect(formatRelative(ago(30 * 3_600_000), now, 'en-GB')).toBe('09 Jun');
    expect(formatRelative(new Date(now.getTime() + 60_000).toISOString(), now)).toBe('Just now');
  });
});
