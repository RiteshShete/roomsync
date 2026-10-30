import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

/** A tappable row with an icon tile, title and a line of help text. Used for the You and House hubs. */
export function NavRow({ to, icon, title, body }: { to: string; icon: IconName; title: string; body: string }) {
  return (
    <Link to={to} className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:bg-tint">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-col break-words">
        <span className="text-base font-bold text-ink">{title}</span>
        <span className="text-sm text-ink2">{body}</span>
      </span>
    </Link>
  );
}

/** The same row, switched off with the reason shown (never a dead link). */
export function DisabledRow({ icon, title, reason }: { icon: IconName; title: string; reason: string }) {
  return (
    <div aria-disabled="true" className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface p-3 opacity-70">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink2">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-col break-words">
        <span className="text-base font-bold text-ink">{title}</span>
        <span className="text-sm text-ink2">{reason}</span>
      </span>
    </div>
  );
}
