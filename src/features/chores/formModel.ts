import type { Chore, ChoreInput } from '@/api/chores';
import { copy } from '@/copy';
import type { ChoreCategory, ChorePriority, RecurrenceFrequency } from '@/domain';

/** Pure model for the create/edit chore form (rules, payload, "nothing changed"). */
export interface ChoreFormState {
  title: string;
  description: string;
  assignee: string; // member id, or '' for unassigned
  dueDate: string; // ISO date, or ''
  recurrence: '' | RecurrenceFrequency;
  rotate: boolean;
  category: '' | ChoreCategory;
  priority: ChorePriority;
  /** Every selectable member, in rotation order. */
  order: string[];
  /** Members taking part in the rotation. */
  included: string[];
}

export interface ChoreCheck {
  ok: boolean;
  reason: string | null;
  input: ChoreInput | null;
}

/** The rotation list as saved: members in order, only those included. */
export function rotationOf(state: ChoreFormState): string[] {
  return state.order.filter((id) => state.included.includes(id));
}

export function checkChoreForm(state: ChoreFormState): ChoreCheck {
  const fail = (reason: string): ChoreCheck => ({ ok: false, reason, input: null });
  const title = state.title.trim();
  if (title.length === 0) return fail(copy.chores.reasonTitle);
  if (title.length > 120) return fail(copy.expenseForm.titleTooLong);
  if (state.recurrence !== '' && state.dueDate === '') return fail(copy.chores.reasonRepeatNeedsDate);
  const rotating = state.recurrence !== '' && state.rotate;
  const rotation = rotationOf(state);
  if (rotating && rotation.length < 2) return fail(copy.chores.reasonRotation);
  return {
    ok: true,
    reason: null,
    input: {
      title,
      description: state.description.trim() === '' ? null : state.description.trim(),
      assigneeMemberId: state.assignee === '' ? null : state.assignee,
      dueDate: state.dueDate === '' ? null : state.dueDate,
      recurrenceFrequency: state.recurrence === '' ? null : state.recurrence,
      rotationMemberIds: rotating ? rotation : null,
      category: state.category === '' ? null : state.category,
      priority: state.priority,
    },
  };
}

export function stateFromChore(c: Chore, selectable: string[]): ChoreFormState {
  const rot = c.rotationMemberIds ?? [];
  const order = [...rot, ...selectable.filter((id) => !rot.includes(id))];
  return {
    title: c.title,
    description: c.description ?? '',
    assignee: c.assigneeMemberId ?? '',
    dueDate: c.dueDate ?? '',
    recurrence: c.recurrenceFrequency ?? '',
    rotate: c.rotationMemberIds !== null,
    category: c.category ?? '',
    priority: c.priority,
    order,
    included: rot.length > 0 ? rot : selectable,
  };
}

export function emptyChoreState(selectable: string[], me: string): ChoreFormState {
  return { title: '', description: '', assignee: me, dueDate: '', recurrence: '', rotate: false, category: '', priority: 'medium', order: selectable, included: selectable };
}

export function inputFromChore(c: Chore): ChoreInput {
  return {
    title: c.title,
    description: c.description,
    assigneeMemberId: c.assigneeMemberId,
    dueDate: c.dueDate,
    recurrenceFrequency: c.recurrenceFrequency,
    rotationMemberIds: c.rotationMemberIds,
    category: c.category,
    priority: c.priority,
  };
}

export const sameChoreInput = (a: ChoreInput, b: ChoreInput): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Move one entry up (-1) or down (+1) in the rotation order; edges are a no-op. */
export function moveInOrder(order: string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
