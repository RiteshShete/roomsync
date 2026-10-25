import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToHousehold, type RealtimeStatus } from '@/api/realtime';

const DEBOUNCE_MS = 300;
const UPDATED_VISIBLE_MS = 2500;
/** If the live channel is down, refetch this often instead (window focus also refetches). */
const FALLBACK_POLL_MS = 30_000;

/**
 * Keeps every screen current: any change to the household's data refreshes the active queries, and
 * `justUpdated` is true briefly so the shell can show a subtle "Updated". If the channel can't
 * connect or drops, it quietly falls back to polling; nothing breaks and no error is shown.
 */
export function useRealtime(householdId: string | undefined): { justUpdated: boolean; status: RealtimeStatus } {
  const client = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [justUpdated, setJustUpdated] = useState(false);
  const timers = useRef<{ debounce?: number; hide?: number }>({});

  useEffect(() => {
    if (!householdId) return;
    const refresh = () => {
      window.clearTimeout(timers.current.debounce);
      timers.current.debounce = window.setTimeout(() => {
        void client.invalidateQueries();
        setJustUpdated(true);
        window.clearTimeout(timers.current.hide);
        timers.current.hide = window.setTimeout(() => setJustUpdated(false), UPDATED_VISIBLE_MS);
      }, DEBOUNCE_MS);
    };
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToHousehold(householdId, refresh, setStatus);
    } catch {
      setStatus('down'); // e.g. the client could not be created: polling below keeps the app usable
    }
    const current = timers.current;
    return () => {
      unsubscribe();
      window.clearTimeout(current.debounce);
      window.clearTimeout(current.hide);
    };
  }, [householdId, client]);

  useEffect(() => {
    if (status !== 'down') return;
    const id = window.setInterval(() => void client.invalidateQueries(), FALLBACK_POLL_MS);
    return () => window.clearInterval(id);
  }, [status, client]);

  return { justUpdated, status };
}
