import type { ActivityEvent } from '@/api/activity';
import { groupByDay } from '@/lib/dayGroups';
import { ActivityRow } from './ActivityRow';

/** Events as cards under TODAY / YESTERDAY / date labels. Shared by Home and the full Activity page. */
export function ActivityList({
  events,
  label,
  nameOf,
  isUnread,
  onOpen,
}: {
  events: ActivityEvent[];
  label: string;
  nameOf: (id: string | null) => string;
  isUnread: (e: ActivityEvent) => boolean;
  onOpen?: (e: ActivityEvent) => void;
}) {
  return (
    <div aria-label={label} role="group" className="flex flex-col gap-4">
      {groupByDay(events).map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wide text-ink2 uppercase">{g.label}</h3>
          <ul className="flex flex-col gap-2">
            {g.events.map((e) => (
              <ActivityRow key={e.id} event={e} nameOf={nameOf} unread={isUnread(e)} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
