import { toAppError } from '@/lib/errors';
import { resolveGuardedUpdate } from './guard';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

type GroceryUpdate = Database['public']['Tables']['grocery_items']['Update'];

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  note: string | null;
  status: 'needed' | 'purchased';
  addedByMemberId: string;
  purchasedByMemberId: string | null;
  purchasedAt: string | null;
  version: number;
  createdAt: string;
}

const COLUMNS = 'id, name, quantity, unit, category, note, status, added_by_member_id, purchased_by_member_id, purchased_at, version, created_at';

type Row = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  note: string | null;
  status: string;
  added_by_member_id: string;
  purchased_by_member_id: string | null;
  purchased_at: string | null;
  version: number;
  created_at: string;
};

function toItem(r: Row): GroceryItem {
  return {
    id: r.id,
    name: r.name,
    quantity: r.quantity === null ? null : Number(r.quantity),
    unit: r.unit,
    category: r.category,
    note: r.note,
    status: r.status as GroceryItem['status'],
    addedByMemberId: r.added_by_member_id,
    purchasedByMemberId: r.purchased_by_member_id,
    purchasedAt: r.purchased_at,
    version: r.version,
    createdAt: r.created_at,
  };
}

/** The list (deleted items hidden), oldest first, capped at 500. */
export async function listGroceries(householdId: string): Promise<GroceryItem[]> {
  const { data, error } = await getSupabase().from('grocery_items').select(COLUMNS).eq('household_id', householdId).is('deleted_at', null).order('created_at', { ascending: true }).limit(500);
  if (error) throw toAppError(error);
  return (data as Row[]).map(toItem);
}

export interface GroceryInput {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  note: string | null;
}

export async function addGrocery(householdId: string, addedByMemberId: string, input: GroceryInput): Promise<string> {
  const { data, error } = await getSupabase()
    .from('grocery_items')
    .insert({ household_id: householdId, added_by_member_id: addedByMemberId, name: input.name, quantity: input.quantity, unit: input.unit, category: input.category, note: input.note })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

/**
 * Every change is guarded by the version the user saw (and the status they expected). Zero rows
 * changed means someone else got there first (conflict) or the database refused it (permission).
 */
async function guarded(id: string, version: number, patch: GroceryUpdate, expectStatus?: 'needed' | 'purchased'): Promise<number> {
  let q = getSupabase().from('grocery_items').update(patch).eq('id', id).eq('version', version).is('deleted_at', null);
  if (expectStatus) q = q.eq('status', expectStatus);
  const { data, error } = await q.select('version');
  if (error) throw toAppError(error);
  return resolveGuardedUpdate(data, async () => {
    const current = await getSupabase().from('grocery_items').select('version, status, deleted_at').eq('id', id).maybeSingle();
    if (current.error) throw toAppError(current.error);
    return !!current.data && (current.data.version !== version || current.data.deleted_at !== null || (!!expectStatus && current.data.status !== expectStatus));
  });
}

export function updateGrocery(id: string, version: number, input: GroceryInput): Promise<number> {
  return guarded(id, version, { name: input.name, quantity: input.quantity, unit: input.unit, category: input.category, note: input.note });
}

export function markPurchased(id: string, version: number, memberId: string): Promise<number> {
  return guarded(id, version, { status: 'purchased', purchased_by_member_id: memberId, purchased_at: new Date().toISOString() }, 'needed');
}

export function moveBackToNeeded(id: string, version: number): Promise<number> {
  return guarded(id, version, { status: 'needed', purchased_by_member_id: null, purchased_at: null }, 'purchased');
}

export function deleteGrocery(id: string, version: number): Promise<number> {
  return guarded(id, version, { deleted_at: new Date().toISOString() });
}

/** Undo a delete. No version check: it only revives the row that this user just deleted. */
export async function restoreGrocery(id: string): Promise<void> {
  const { error } = await getSupabase().from('grocery_items').update({ deleted_at: null }).eq('id', id);
  if (error) throw toAppError(error);
}
