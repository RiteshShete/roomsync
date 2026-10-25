import type { ActivityEvent } from '@/api/activity';
import { copy } from '@/copy';
import { formatMoney } from '@/domain';

/** Where tapping an event goes. Never a dead link: every event type maps to a real screen. */
export function eventLink(ev: Pick<ActivityEvent, 'eventType' | 'entityType' | 'entityId'>): string {
  switch (ev.eventType.split('.')[0]) {
    case 'expense':
      return ev.entityId ? `/expenses/${ev.entityId}` : '/expenses';
    case 'settlement':
      return '/expenses/settlements';
    case 'chore':
      return '/chores';
    case 'grocery':
      return '/house/groceries';
    case 'announcement':
      return '/house/announcements';
    case 'household':
      return '/you/household';
    default:
      return '/you/members';
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** One neutral sentence for an event, built only from the actor's name and the metadata (titles, amounts). */
export function describeEvent(ev: ActivityEvent, nameOf: (memberId: string | null) => string): string {
  const who = ev.actorMemberId ? nameOf(ev.actorMemberId) : copy.activity.someone;
  const minor = ev.metadata.amount_minor;
  const amount = typeof minor === 'number' ? ` · ${formatMoney(minor, str(ev.metadata.currency_code) || 'INR')}` : '';
  const line = copy.activity.lines[ev.eventType];
  return line ? line(who, str(ev.metadata.title) || str(ev.metadata.name), amount) : copy.activity.fallback(who);
}
