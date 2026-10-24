import type { ReactNode } from 'react';
import { copy } from '@/copy';
import { IconButton } from './Button';
import { BrandMark, Icon } from './Icon';

export interface HeaderProps {
  title: string;
  /** When set, shows a back button. */
  onBack?: () => void;
  /** Show the notifications bell. Disabled (with a stated reason) until the activity centre exists. */
  bell?: { unread?: number; onClick?: () => void; disabledReason?: string };
  right?: ReactNode;
  /** Show the RoomSync mark next to the title (used on Home). */
  brand?: boolean;
}

/** Sticky top bar: back button, title, optional bell with unread badge. */
export function Header({ title, onBack, bell, right, brand = false }: HeaderProps) {
  const unread = bell?.unread ?? 0;
  const disabled = Boolean(bell?.disabledReason);
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-line bg-surface px-3 pt-[env(safe-area-inset-top)]">
      {onBack ? (
        <IconButton label={copy.header.back} icon={<Icon name="back" />} onClick={onBack} />
      ) : brand ? (
        <span className="pl-1">
          <BrandMark size={36} />
        </span>
      ) : null}
      <h1 className={`flex-1 truncate text-xl font-extrabold ${brand ? 'text-primary' : 'text-ink'}`}>{title}</h1>
      {right}
      {bell ? (
        <span className="relative">
          <IconButton
            label={unread > 0 ? `${copy.header.notifications}, ${unread} unread` : copy.header.notifications}
            icon={<Icon name="bell" />}
            disabled={disabled}
            disabledReason={bell.disabledReason}
            onClick={bell.onClick}
          />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-extrabold text-on-primary"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </span>
      ) : null}
    </header>
  );
}
