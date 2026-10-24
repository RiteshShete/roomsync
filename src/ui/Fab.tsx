import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/**
 * Coral floating "+" button from the mockups. Pinned above the bottom nav inside the same
 * max-width column, so it never covers the nav or drifts off-screen on wide displays. When it can't
 * act (e.g. archived household) it stays focusable, looks inactive, and says why.
 */
export function Fab({ to, onClick, label, disabledReason }: { to?: string; onClick?: () => void; label: string; disabledReason?: string }) {
  const reasonId = useId();
  const cls = 'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-end px-4">
      {disabledReason ? (
        <>
          <button type="button" aria-label={label} aria-disabled="true" aria-describedby={reasonId} title={disabledReason} onClick={(e) => e.preventDefault()} className={`${cls} cursor-not-allowed opacity-50`}>
            <Icon name="plus" size={28} />
          </button>
          <span id={reasonId} className="sr-only">
            {disabledReason}
          </span>
        </>
      ) : to ? (
        <Link to={to} aria-label={label} title={label} className={`${cls} hover:bg-primary-pressed`}>
          <Icon name="plus" size={28} />
        </Link>
      ) : (
        <button type="button" aria-label={label} title={label} onClick={onClick} className={`${cls} cursor-pointer hover:bg-primary-pressed`}>
          <Icon name="plus" size={28} />
        </button>
      )}
    </div>
  );
}
