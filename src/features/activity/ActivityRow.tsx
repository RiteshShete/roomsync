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
    <li className="border-b border-line last:border-b-0">
      <Link to={eventLink(event)} onClick={() => onOpen?.(event)} className="flex min-h-16 items-start gap-3 px-4 py-3 hover:bg-brand-soft">
        <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${unread ? 'bg-primary' : 'bg-transparent'}`} />
        <span className="min-w-0 flex-1">
          <span className={`block text-base text-ink-strong ${unread ? 'font-bold' : ''}`}>
            {unread ? <span className="sr-only">{copy.activity.unreadAria}: </span> : null}
            {describeEvent(event, nameOf)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink2">
            <Chip>{copy.activity.categories[categoryOf(event.eventType)]}</Chip>
            <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          </span>
        </span>
      </Link>
    </li>
  );
}
