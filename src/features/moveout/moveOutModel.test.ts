import { describe, expect, it } from 'vitest';
import { copy } from '@/copy';
import { checkMoveOut, checkNote, NOTE_MAX } from './moveOutModel';

const TODAY = '2026-10-25';
const ok = { date: '2026-11-01', note: '', understood: true };

describe('checkMoveOut', () => {
  it('a valid date plus the confirmation is enough; a blank note becomes null', () => {
    expect(checkMoveOut(ok, TODAY)).toEqual({ ok: true, reason: null, input: { effectiveDate: '2026-11-01', note: null } });
  });

  it('trims the note', () => {
    expect(checkMoveOut({ ...ok, note: '  deposit?  ' }, TODAY).input?.note).toBe('deposit?');
  });

  it.each([
    [{ ...ok, date: '' }, copy.moveOut.dateReasons.missing],
    [{ ...ok, date: '2026-10-24' }, copy.moveOut.dateReasons.past],
    [{ ...ok, date: '2027-02-01' }, copy.moveOut.dateReasons.tooFar],
    [{ ...ok, date: '31/12/2026' }, copy.moveOut.dateReasons.invalid],
    [{ ...ok, note: 'x'.repeat(NOTE_MAX + 1) }, copy.moveOut.noteReasonLong],
    [{ ...ok, understood: false }, copy.moveOut.reasonUnderstand],
  ])('blocks %j with a reason', (draft, reason) => {
    const c = checkMoveOut(draft, TODAY);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe(reason);
    expect(c.input).toBeNull();
  });

  it('the date problem is reported before the missing confirmation', () => {
    expect(checkMoveOut({ date: '', note: '', understood: false }, TODAY).reason).toBe(copy.moveOut.dateReasons.missing);
  });

  it('today is allowed, and so is a note of exactly the maximum length', () => {
    expect(checkMoveOut({ ...ok, date: TODAY, note: 'x'.repeat(NOTE_MAX) }, TODAY).ok).toBe(true);
  });
});

describe('checkNote', () => {
  it('accepts text and trims it', () => expect(checkNote('  my deposit  ')).toEqual({ ok: true, reason: null, note: 'my deposit' }));
  it('rejects blank and over-long notes', () => {
    expect(checkNote('   ').reason).toBe(copy.moveOut.noteReasonEmpty);
    expect(checkNote('x'.repeat(NOTE_MAX + 1)).reason).toBe(copy.moveOut.noteReasonLong);
    expect(checkNote('x'.repeat(NOTE_MAX)).ok).toBe(true);
  });
});
