import type { ReactNode } from 'react';
import { copy } from '@/copy';
import { IconButton } from './Button';
import { BrandMark, Icon } from './Icon';

export interface HeaderProps {
  title: string;
  /** When set, shows a back button. */
  onBack?: () => void;
  /** Show the notifications bell with an unread badge; `onClick` opens the activity centre. */
  bell?: { unread?: number; onClick?: () => void; disabledReason?: string };
  right?: ReactNode;
  /** Home style: brand tile and a bold coral title. Other pages use a plain regular-weight title. */
  brand?: boolean;
  /** Content rendered inside the header under the title row (e.g. tabs), like the mockups. */
  children?: ReactNode;
}

/**
 * White top bar with a rounded bottom edge and a soft shadow (as in the mockups). Section pages use
 * a regular-weight dark title; Home uses the brand tile with a bold coral title.
 */
export function Header({ title, onBack, bell, right, brand = false, children }: HeaderProps) {
  const unread = bell?.unread ?? 0;
  const disabled = Boolean(bell?.disabledReason);
  return (
    <header className="sticky top-0 z-30 rounded-b-[1.25rem] border-b border-line bg-surface pt-[env(safe-area-inset-top)] shadow-[0_2px_8px_rgb(61_61_61/0.05)]">
      <div className="flex min-h-16 items-center gap-2 px-4">
        {onBack ? (
          <IconButton label={copy.header.back} icon={<Icon name="back" />} onClick={onBack} className="-ml-2" />
        ) : brand ? (
          <BrandMark size={40} />
        ) : null}
        <h1 className={`min-w-0 flex-1 truncate text-xl font-bold ${brand ? 'text-coral' : 'text-ink-strong'}`}>{title}</h1>
        {right}
        {bell ? (
          <span className="relative">
            <IconButton
              label={unread > 0 ? copy.header.notificationsUnread(unread) : copy.header.notifications}
              icon={<Icon name="bell" />}
              disabled={disabled}
              disabledReason={bell.disabledReason}
              onClick={bell.onClick}
            />
            {unread > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-on-primary"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {children}
    </header>
  );
}

/** Underlined tab strip for use inside <Header>, as in the Expenses/Task mockups (coral underline, counts). */
export function HeaderTabs({ children, label }: { children: ReactNode; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-4 overflow-x-auto px-4 min-[360px]:gap-6">
      {children}
    </nav>
  );
}
