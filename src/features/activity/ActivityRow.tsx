import { Link } from 'react-router-dom';
import type { ActivityEvent } from '@/api/activity';
import { copy } from '@/copy';
import { categoryOf, type NotificationCategory } from '@/domain';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Icon, type IconName } from '@/ui';
import { actorOf, describeEvent, eventLink } from './describe';

const TILE: Record<NotificationCategory, { icon: IconName; tone: string }> = {
  expenses: { icon: 'wallet', tone: 'bg-success-soft text-success-text' },
  settlements: { icon: 'swap', tone: 'bg-success-soft text-success-text' },
  chores: { icon: 'checklist', tone: 'bg-success-soft text-success-text' },
  groceries: { icon: 'cart', tone: 'bg-warning-soft text-warning' },
  announcements: { icon: 'megaphone', tone: 'bg-info-soft text-info' },
  household: { icon: 'house', tone: 'bg-brand-soft text-coral' },
};

/**
 * One event as a card, from the design: a tinted category tile, the sentence with the actor in bold,
 * and how long ago on the right. The category is the tile's label for screen readers; unread is a dot
 * plus hidden text, never colour alone.
 */
export function ActivityRow({
  event,
  nameOf,
  unread,
  onOpen,
}: {
  event: ActivityEvent;
  nameOf: (id: string | null) => string;
  unread: boolean;
  onOpen?: (e: ActivityEvent) => void;
}) {
  const category = categoryOf(event.eventType);
  const tile = TILE[category];
  const text = describeEvent(event, nameOf);
  const who = actorOf(event, nameOf);
  const boldWho = text.startsWith(who);

  return (
    <li className="relative">
      <Link
        to={eventLink(event)}
        onClick={() => onOpen?.(event)}
        className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-[0_1px_3px_rgba(61,61,61,0.04)] hover:bg-brand-soft"
      >
        {unread ? <span aria-hidden="true" className="absolute top-2 left-1.5 h-2 w-2 rounded-full bg-primary" /> : null}
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tile.tone}`}>
          <Icon name={tile.icon} size={22} />
        </span>
        <span className="min-w-0 flex-1 text-sm text-ink break-words">
          <span className="sr-only">
            {unread ? `${copy.activity.unreadAria}: ` : ''}
            {copy.activity.categories[category]}:{' '}
          </span>
          {boldWho ? (
            <>
              <strong className="font-bold text-ink-strong">{who}</strong>
              {text.slice(who.length)}
            </>
          ) : (
            text
          )}
        </span>
        <time dateTime={event.createdAt} title={formatDateTime(event.createdAt)} className="max-w-[5.5rem] shrink-0 text-right text-[11px] leading-tight text-ink2">
          {formatRelative(event.createdAt)}
        </time>
      </Link>
    </li>
  );
}
