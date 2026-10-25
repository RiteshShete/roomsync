import type { RecurrenceFrequency } from '@/domain';
import { toAppError } from '@/lib/errors';
import { resolveGuardedUpdate } from './guard';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

type ChoreUpdate = Database['public']['Tables']['chores']['Update'];

export interface Chore {
  id: string;
  title: string;
  description: string | null;
  assigneeMemberId: string | null;
  dueDate: string | null;
  recurrenceFrequency: RecurrenceFrequency | null;
  rotationMemberIds: string[] | null;
  status: 'open' | 'completed' | 'cancelled';
  createdBy: string;
  completedAt: string | null;
  completedBy: string | null;
  version: number;
  createdAt: string;
}

const COLUMNS =
  'id, title, description, assignee_member_id, due_date, recurrence_frequency, rotation_member_ids, status, created_by, completed_at, completed_by, version, created_at';

type Row = {
  id: string;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  due_date: string | null;
  recurrence_frequency: string | null;
  rotation_member_ids: string[] | null;
  status: string;
  created_by: string;
  completed_at: string | null;
  completed_by: string | null;
  version: number;
  created_at: string;
};

function toChore(r: Row): Chore {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    assigneeMemberId: r.assignee_member_id,
    dueDate: r.due_date,
    recurrenceFrequency: r.recurrence_frequency as RecurrenceFrequency | null,
    rotationMemberIds: r.rotation_member_ids,
    status: r.status as Chore['status'],
    createdBy: r.created_by,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    version: r.version,
    createdAt: r.created_at,
  };
}

/** Open chores (up to 300, soonest first) and the 50 most recently completed. Cancelled chores are hidden. */
export async function listChores(householdId: string): Promise<{ open: Chore[]; completed: Chore[] }> {
  const supabase = getSupabase();
  const [open, done] = await Promise.all([
    supabase.from('chores').select(COLUMNS).eq('household_id', householdId).eq('status', 'open').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).limit(300),
    supabase.from('chores').select(COLUMNS).eq('household_id', householdId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(50),
  ]);
  if (open.error) throw toAppError(open.error);
  if (done.error) throw toAppError(done.error);
  return { open: (open.data as Row[]).map(toChore), completed: (done.data as Row[]).map(toChore) };
}

export async function getChore(id: string): Promise<Chore> {
  const { data, error } = await getSupabase().from('chores').select(COLUMNS).eq('id', id).single();
  if (error) throw toAppError(error);
  return toChore(data as Row);
}

export interface ChoreInput {
  title: string;
  description: string | null;
  assigneeMemberId: string | null;
  dueDate: string | null;
  recurrenceFrequency: RecurrenceFrequency | null;
  rotationMemberIds: string[] | null;
}

export async function createChore(householdId: string, createdBy: string, input: ChoreInput): Promise<string> {
  const { data, error } = await getSupabase()
    .from('chores')
    .insert({
      household_id: householdId,
      created_by: createdBy,
      title: input.title,
      description: input.description,
      assignee_member_id: input.assigneeMemberId,
      due_date: input.dueDate,
      recurrence_frequency: input.recurrenceFrequency,
      rotation_member_ids: input.rotationMemberIds,
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

/**
 * Optimistic update: only applies if the version still matches. Zero rows changed means either the
 * chore moved on (conflict) or the database refused it (permission), so check which.
 */
async function guardedUpdate(id: string, version: number, patch: ChoreUpdate): Promise<number> {
  const { data, error } = await getSupabase().from('chores').update(patch).eq('id', id).eq('version', version).eq('status', 'open').select('version');
  if (error) throw toAppError(error);
  return resolveGuardedUpdate(data, async () => {
    const current = await getSupabase().from('chores').select('version, status').eq('id', id).maybeSingle();
    if (current.error) throw toAppError(current.error);
    return !!current.data && (current.data.version !== version || current.data.status !== 'open');
  });
}

export function updateChore(id: string, version: number, input: ChoreInput): Promise<number> {
  return guardedUpdate(id, version, {
    title: input.title,
    description: input.description,
    assignee_member_id: input.assigneeMemberId,
    due_date: input.dueDate,
    recurrence_frequency: input.recurrenceFrequency,
    rotation_member_ids: input.rotationMemberIds,
  });
}

export function cancelChore(id: string, version: number): Promise<number> {
  return guardedUpdate(id, version, { status: 'cancelled', cancel_reason: 'Cancelled by a member' });
}

export interface CompleteResult {
  nextChoreId: string | null;
  nextAssigneeMemberId: string | null;
  skippedMemberIds: string[];
}

export async function completeChore(id: string, expectedVersion?: number): Promise<CompleteResult> {
  const { data, error } = await getSupabase().rpc('complete_chore', { p_chore_id: id, p_expected_version: expectedVersion });
  if (error) throw toAppError(error);
  const r = data as { next_chore_id: string | null; next_assignee_member_id: string | null; skipped_member_ids: string[] };
  return { nextChoreId: r.next_chore_id, nextAssigneeMemberId: r.next_assignee_member_id, skippedMemberIds: r.skipped_member_ids ?? [] };
}

export async function reopenChore(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('reopen_chore', { p_chore_id: id });
  if (error) throw toAppError(error);
}
