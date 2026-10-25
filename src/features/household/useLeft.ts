import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listMyLeftHouseholds, reconcileHousehold, type LeftHousehold } from '@/api/households';

const dismissedKey = (householdId: string) => `roomsync.left-seen:${householdId}`;

/** Whether this device has already shown the "You've left" screen for a household. Storage may be blocked; then it is just shown again. */
export function isLeftNoticeDismissed(householdId: string): boolean {
  try {
    return window.localStorage.getItem(dismissedKey(householdId)) === '1';
  } catch {
    return false;
  }
}

export function dismissLeftNotice(householdId: string): void {
  try {
    window.localStorage.setItem(dismissedKey(householdId), '1');
  } catch {
    // Not remembered: the notice simply appears again next time, which is harmless.
  }
}

/** Households the signed-in user has left (name and date only). Only asked for when they have no household. */
export function useLeftHouseholds(enabled: boolean) {
  return useQuery({ queryKey: ['left-households'], queryFn: listMyLeftHouseholds, enabled, staleTime: 0, gcTime: 0 });
}

/** The most recent left household this device has not shown a notice for, if any. */
export function pendingLeftNotice(left: LeftHousehold[] | undefined): LeftHousehold | null {
  return left?.find((h) => !isLeftNoticeDismissed(h.householdId)) ?? null;
}

/**
 * Applies move-outs whose date has passed, once each time the household is opened. Without it a
 * person whose date has arrived would keep seeing the household until some other action triggered
 * the same check, and others would keep seeing them as "moving out". Best effort: a failure is
 * retried the next time the app opens and never interrupts anyone.
 */
export function useReconcileOnOpen(householdId: string | undefined) {
  const client = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    let active = true;
    reconcileHousehold(householdId)
      .then((flipped) => {
        if (active && flipped > 0) void client.invalidateQueries();
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [householdId, client]);
}
