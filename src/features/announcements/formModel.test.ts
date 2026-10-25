import { describe, expect, it } from 'vitest';
import { copy } from '@/copy';
import { BODY_MAX, checkAnnouncement, TITLE_MAX } from './formModel';

describe('checkAnnouncement', () => {
  it('trims and accepts a title and a message', () => {
    const c = checkAnnouncement({ title: '  Water off ', body: ' Tuesday 10-12 ' });
    expect(c).toEqual({ ok: true, reason: null, input: { title: 'Water off', body: 'Tuesday 10-12' } });
  });

  it.each([
    [{ title: '  ', body: 'x' }, copy.announcements.reasonTitle],
    [{ title: 'x', body: '   ' }, copy.announcements.reasonMessage],
    [{ title: 'x'.repeat(TITLE_MAX + 1), body: 'x' }, copy.announcements.reasonTitleLong],
    [{ title: 'x', body: 'x'.repeat(BODY_MAX + 1) }, copy.announcements.reasonMessageLong],
  ])('blocks %j with a reason', (draft, reason) => {
    const c = checkAnnouncement(draft);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe(reason);
    expect(c.input).toBeNull();
  });

  it('allows exactly the maximum lengths', () => {
    expect(checkAnnouncement({ title: 'x'.repeat(TITLE_MAX), body: 'y'.repeat(BODY_MAX) }).ok).toBe(true);
  });

  it('when editing, an unchanged form (even with stray spaces) cannot be saved', () => {
    const original = { title: 'Water off', body: 'Tuesday' };
    expect(checkAnnouncement({ title: ' Water off', body: 'Tuesday ' }, original).reason).toBe(copy.announcements.reasonSame);
    expect(checkAnnouncement({ title: 'Water off', body: 'Wednesday' }, original).ok).toBe(true);
  });
});
