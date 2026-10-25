import { Link } from 'react-router-dom';
import type { ActivityEvent } from '@/api/activity';
import { copy } from '@/copy';
import { categoryOf } from '@/domain';
import { formatDateTime } from '@/lib/format';
import { Chip } from '@/ui';
import { describeEvent, eventLink } from './describe';

/** One event: a sentence, its category and time, a deep link, and an unread marker (text, not colour alone). */
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
  return (
    <li className="relative border-b border-line last:border-b-0">
      <Link to={eventLink(event)} onClick={() => onOpen?.(event)} className="block min-h-16 px-4 py-3 hover:bg-brand-soft">
        {/* The unread dot sits in the left padding, so read and unread rows share one text edge. */}
        {unread ? <span aria-hidden="true" className="absolute top-[1.15rem] left-1.5 h-2 w-2 rounded-full bg-primary" /> : null}
        <span className="block min-w-0">
          <span className={`block text-base text-ink-strong ${unread ? 'font-bold' : ''}`}>
            {unread ? <span className="sr-only">{copy.activity.unreadAria}: </span> : null}
            {describeEvent(event, nameOf)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink2">
            <Chip>{copy.activity.categories[categoryOf(event.eventType)]}</Chip>
            <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          </span>
        </span>
      </Link>
    </li>
  );
}
