import { describe, expect, it } from 'vitest';
import type { NotificationPrefs } from '@/api/activity';
import { copy } from '@/copy';
import { checkPrefs, draftFromPrefs, toHHMM } from './prefsModel';
import { checkProfile, NAME_MAX } from './profileModel';

describe('checkProfile', () => {
  const saved = { displayName: 'Asha', avatarColor: '#E4573D' };

  it('trims the name and accepts a change', () => {
    expect(checkProfile({ displayName: '  Asha K ', avatarColor: '#E4573D' }, saved)).toEqual({
      ok: true,
      reason: null,
      input: { displayName: 'Asha K', avatarColor: '#E4573D' },
    });
    expect(checkProfile({ displayName: 'Asha', avatarColor: '#0B8A63' }, saved).ok).toBe(true);
  });

  it.each([
    [{ displayName: '   ', avatarColor: '#E4573D' }, copy.profileEdit.reasonName],
    [{ displayName: 'x'.repeat(NAME_MAX + 1), avatarColor: '#E4573D' }, copy.profileEdit.reasonNameLong],
    [{ displayName: ' Asha ', avatarColor: '#e4573d' }, copy.profileEdit.reasonSame],
  ])('blocks %j with a reason', (draft, reason) => {
    const c = checkProfile(draft, saved);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe(reason);
    expect(c.input).toBeNull();
  });
});

describe('notification preferences model', () => {
  const saved: NotificationPrefs = { categories: { groceries: false }, quietEnabled: true, quietStart: '22:00:00', quietEnd: '07:00:00' };

  it('turns stored prefs into a draft: missing means on, times lose their seconds', () => {
    const d = draftFromPrefs(saved);
    expect(d.categories).toEqual({ expenses: true, settlements: true, chores: true, groceries: false, announcements: true, household: true });
    expect([d.quietStart, d.quietEnd]).toEqual(['22:00', '07:00']);
    expect(toHHMM(null)).toBe('');
  });

  it('an untouched draft equals what is saved, so Save stays disabled', () => {
    const c = checkPrefs(draftFromPrefs(saved), saved);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe(copy.notificationPrefs.reasonSame);
  });

  it('stores only the switched-off categories', () => {
    const d = draftFromPrefs(saved);
    d.categories.chores = false;
    d.categories.groceries = true;
    const c = checkPrefs(d, saved);
    expect(c.ok).toBe(true);
    expect(c.input?.categories).toEqual({ chores: false });
  });

  it('quiet hours need both times when switched on, but are remembered when off', () => {
    const d = { ...draftFromPrefs(saved), quietStart: '' };
    expect(checkPrefs(d, saved).reason).toBe(copy.notificationPrefs.reasonTimes);
    const off = checkPrefs({ ...draftFromPrefs(saved), quietEnabled: false }, saved);
    expect(off.ok).toBe(true);
    expect(off.input).toMatchObject({ quietEnabled: false, quietStart: '22:00', quietEnd: '07:00' });
  });
});
