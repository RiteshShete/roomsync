import { toAppError } from '@/lib/errors';

/**
 * Shared tail of every optimistic-concurrency update (chores, groceries, announcements).
 *
 * The caller runs `update ... where id = ? and version = ?` and passes the rows it changed. Zero
 * rows means one of two things: someone else got there first (`conflict`) or row-level security
 * refused the write (`permission_denied`). `hasMoved` re-reads the row to tell which.
 */
export async function resolveGuardedUpdate(changed: { version: number }[], hasMoved: () => Promise<boolean>): Promise<number> {
  if (changed.length > 0) return changed[0]!.version;
  throw toAppError({ message: (await hasMoved()) ? 'conflict' : 'permission_denied' });
}
