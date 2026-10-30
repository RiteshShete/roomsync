import { copy } from '@/copy';
import { IconButton } from './Button';
import { Icon } from './Icon';

/** The notifications bell with its unread count, shared by every header that shows it. */
export function BellButton({ unread = 0, onClick }: { unread?: number; onClick?: () => void }) {
  return (
    <span className="relative">
      <IconButton label={unread > 0 ? copy.header.notificationsUnread(unread) : copy.header.notifications} icon={<Icon name="bell" />} onClick={onClick} />
      {unread > 0 ? (
        <span aria-hidden="true" className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-on-primary">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </span>
  );
}
