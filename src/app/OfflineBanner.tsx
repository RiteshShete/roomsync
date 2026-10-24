import { copy } from '@/copy';
import { useOnline } from '@/lib/useOnline';

/** Sticky notice while the browser is offline. It says changes are not saved (there is no offline queue). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[70] bg-warning-soft px-4 py-2 text-center text-sm font-bold text-ink"
    >
      {copy.offline}
    </div>
  );
}
