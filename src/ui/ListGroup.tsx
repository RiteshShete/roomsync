import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

/** A titled group of related rows in one bordered card, divided by hairlines (settings-style lists). */
export function ListGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="px-1 text-sm font-bold text-ink2">
        {title}
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{children}</ul>
    </section>
  );
}

/** One tappable row inside a `ListGroup`: icon, title, a line of help, and a chevron. */
export function ListRow({ to, icon, title, body }: { to: string; icon: IconName; title: string; body: string }) {
  return (
    <li>
      <Link to={to} className="flex min-h-14 items-center gap-3 px-3 py-2.5 hover:bg-tint">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Icon name={icon} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-bold text-ink">{title}</span>
          <span className="text-sm text-ink2">{body}</span>
        </span>
        <Icon name="chevron" size={18} className="shrink-0 text-ink3" aria-hidden="true" />
      </Link>
    </li>
  );
}
