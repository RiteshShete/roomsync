import { describe, expect, it } from 'vitest';
import type { Chore } from '@/api/chores';
import { copy } from '@/copy';
import { checkChoreForm, emptyChoreState, inputFromChore, moveInOrder, rotationOf, sameChoreInput, stateFromChore, type ChoreFormState } from './formModel';

const MEMBERS = ['a', 'b', 'c'];
const base = (o: Partial<ChoreFormState> = {}): ChoreFormState => ({ ...emptyChoreState(MEMBERS, 'a'), title: 'Dishes', ...o });

describe('checkChoreForm', () => {
  it('a plain chore needs only a title and defaults to the creator as assignee', () => {
    const c = checkChoreForm(base());
    expect(c.ok).toBe(true);
    expect(c.input).toEqual({ title: 'Dishes', description: null, assigneeMemberId: 'a', dueDate: null, recurrenceFrequency: null, rotationMemberIds: null });
  });

  it('trims, and turns blanks into null', () => {
    const c = checkChoreForm(base({ title: '  Dishes ', description: '   ', assignee: '' }));
    expect(c.input).toMatchObject({ title: 'Dishes', description: null, assigneeMemberId: null });
  });

  it.each([
    [{ title: '  ' }, copy.chores.reasonTitle],
    [{ title: 'x'.repeat(121) }, copy.expenseForm.titleTooLong],
    [{ recurrence: 'weekly' as const }, copy.chores.reasonRepeatNeedsDate],
  ])('blocks %j with a reason', (o, reason) => {
    const c = checkChoreForm(base(o));
    expect(c.ok).toBe(false);
    expect(c.reason).toBe(reason);
    expect(c.input).toBeNull();
  });

  it('a recurring chore with a due date is valid, without rotation', () => {
    const c = checkChoreForm(base({ recurrence: 'weekly', dueDate: '2026-06-01' }));
    expect(c.input).toMatchObject({ recurrenceFrequency: 'weekly', dueDate: '2026-06-01', rotationMemberIds: null });
  });

  it('rotation needs at least two people and keeps the chosen order', () => {
    const s = base({ recurrence: 'weekly', dueDate: '2026-06-01', rotate: true, order: ['c', 'a', 'b'], included: ['a', 'c'] });
    expect(checkChoreForm({ ...s, included: ['a'] }).reason).toBe(copy.chores.reasonRotation);
    expect(checkChoreForm(s).input?.rotationMemberIds).toEqual(['c', 'a']);
    expect(rotationOf(s)).toEqual(['c', 'a']);
  });

  it('rotation is ignored when the chore does not repeat', () => {
    const c = checkChoreForm(base({ rotate: true, included: ['a'] }));
    expect(c.ok).toBe(true);
    expect(c.input?.rotationMemberIds).toBeNull();
  });
});

describe('moveInOrder', () => {
  it('moves up and down, and ignores the edges and unknown ids', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveInOrder(['a', 'b'], 'zz', 1)).toEqual(['a', 'b']);
  });
  it('does not mutate its input', () => {
    const o = ['a', 'b'];
    moveInOrder(o, 'a', 1);
    expect(o).toEqual(['a', 'b']);
  });
});

describe('edit round trip', () => {
  const chore: Chore = {
    id: 'c1', title: 'Trash', description: 'Take it out', assigneeMemberId: 'b', dueDate: '2026-06-01', recurrenceFrequency: 'weekly',
    rotationMemberIds: ['b', 'c'], status: 'open', createdBy: 'u', completedAt: null, completedBy: null, version: 4, createdAt: '',
  };

  it('rebuilds the form with the saved rotation first, then everyone else', () => {
    const s = stateFromChore(chore, MEMBERS);
    expect(s.order).toEqual(['b', 'c', 'a']);
    expect(s.included).toEqual(['b', 'c']);
    expect(s.rotate).toBe(true);
    expect(s.assignee).toBe('b');
  });

  it('an unchanged form equals the saved chore (so Save stays disabled)', () => {
    const c = checkChoreForm(stateFromChore(chore, MEMBERS));
    expect(sameChoreInput(c.input!, inputFromChore(chore))).toBe(true);
  });

  it('a change is detected, including reordering the rotation', () => {
    const s = stateFromChore(chore, MEMBERS);
    expect(sameChoreInput(checkChoreForm({ ...s, title: 'Bins' }).input!, inputFromChore(chore))).toBe(false);
    expect(sameChoreInput(checkChoreForm({ ...s, order: ['c', 'b', 'a'] }).input!, inputFromChore(chore))).toBe(false);
  });

  it('a chore without rotation starts with everyone selected but rotation off', () => {
    const s = stateFromChore({ ...chore, rotationMemberIds: null }, MEMBERS);
    expect(s.rotate).toBe(false);
    expect(s.included).toEqual(MEMBERS);
  });
});
