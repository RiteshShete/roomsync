import type { ReactNode } from 'react';
import { copy } from '@/copy';
import { IconButton } from './Button';
import { BellButton } from './BellButton';
import { Icon } from './Icon';

export interface HeaderProps {
  title: string;
  /** When set, shows a back button. */
  onBack?: () => void;
  /** Show the notifications bell with an unread badge; `onClick` opens the activity centre. */
  bell?: { unread?: number; onClick?: () => void };
  right?: ReactNode;
  /** Content rendered inside the header under the title row (e.g. tabs), like the mockups. */
  children?: ReactNode;
}

/**
 * White top bar with a rounded bottom edge and a soft shadow. Section pages use a bold dark title. (Home
 * builds its own panel with the logo and the House Feed.)
 */
export function Header({ title, onBack, bell, right, children }: HeaderProps) {
  const unread = bell?.unread ?? 0;
  return (
    <header className="sticky top-0 z-30 rounded-b-[1.25rem] border-b border-line bg-surface pt-[env(safe-area-inset-top)] shadow-[0_2px_8px_rgb(61_61_61/0.05)]">
      <div className="flex min-h-16 items-center gap-2 px-4">
        {onBack ? (
          <IconButton label={copy.header.back} icon={<Icon name="back" />} onClick={onBack} className="-ml-2" />
        ) : null}
        <h1 className={`min-w-0 flex-1 truncate text-xl font-bold text-ink-strong`}>{title}</h1>
        {right}
        {bell ? <BellButton unread={unread} onClick={bell.onClick} /> : null}
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
