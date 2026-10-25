import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { resolveGuardedUpdate } from './guard';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  version: number;
}

export interface AnnouncementInput {
  title: string;
  body: string;
}

const COLUMNS = 'id, title, body, created_by, created_at, updated_at, pinned_at, version';

interface Row {
  id: string;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  pinned_at: string | null;
  version: number;
}

const fromRow = (r: Row): Announcement => ({
  id: r.id,
  title: r.title,
  body: r.body,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  pinnedAt: r.pinned_at,
  version: r.version,
});

/** Live announcements, pinned first, then newest first. */
export async function listAnnouncements(householdId: string): Promise<Announcement[]> {
  const { data, error } = await getSupabase()
    .from('announcements')
    .select(COLUMNS)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw toAppError(error);
  return data.map(fromRow);
}

export async function createAnnouncement(householdId: string, authorUserId: string, input: AnnouncementInput): Promise<void> {
  const { error } = await getSupabase()
    .from('announcements')
    .insert({ household_id: householdId, created_by: authorUserId, title: input.title, body: input.body });
  if (error) throw toAppError(error);
}

/** Version-guarded: a concurrent change becomes `conflict`, a refused write `permission_denied`. */
async function guarded(id: string, version: number, patch: { title?: string; body?: string; pinned_at?: string | null; deleted_at?: string }): Promise<number> {
  const { data, error } = await getSupabase().from('announcements').update(patch).eq('id', id).eq('version', version).is('deleted_at', null).select('version');
  if (error) throw toAppError(error);
  return resolveGuardedUpdate(data, async () => {
    const current = await getSupabase().from('announcements').select('version, deleted_at').eq('id', id).maybeSingle();
    if (current.error) throw toAppError(current.error);
    return !!current.data && (current.data.version !== version || current.data.deleted_at !== null);
  });
}

export const updateAnnouncement = (id: string, version: number, input: AnnouncementInput) => guarded(id, version, { title: input.title, body: input.body });
export const setAnnouncementPinned = (id: string, version: number, pinned: boolean) => guarded(id, version, { pinned_at: pinned ? new Date().toISOString() : null });
/** Soft delete: the row stays (and stays in the data export). */
export const deleteAnnouncement = (id: string, version: number) => guarded(id, version, { deleted_at: new Date().toISOString() });
