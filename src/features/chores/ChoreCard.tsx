import { Link } from 'react-router-dom';
import type { Chore } from '@/api/chores';
import type { MemberWithLeft } from '@/api/households';
import { copy } from '@/copy';
import { dueInfo } from '@/domain';
import { formatDay } from '@/lib/format';
import { Avatar, Button, Chip, Icon, IconButton } from '@/ui';

export interface ChoreCardProps {
  chore: Chore;
  today: string;
  assignee: MemberWithLeft | undefined;
  completer?: string;
  canDone: boolean;
  canEdit: boolean;
  /** Set when every write is off (archived household). */
  blockedReason: string | null;
  busy: boolean;
  onDone: () => void;
  onReopen: () => void;
}

/** When it is due, as a short line under the title. Neutral wording: overdue never turns red or shames anyone (spec §8.6). */
function Due({ chore, today }: { chore: Chore; today: string }) {
  const d = dueInfo(chore.dueDate, today);
  if (d.kind === 'none') return <span className="text-ink2">{copy.chores.due.none}</span>;
  if (d.kind === 'overdue') return <span className="text-ink2">{copy.chores.wasDue(formatDay(chore.dueDate!))}</span>;
  if (d.kind === 'today') return <span className="font-bold text-coral">{copy.chores.due.today}</span>;
  if (d.kind === 'tomorrow') return <span className="font-bold text-coral">{copy.chores.due.tomorrow}</span>;
  return (
    <span>
      <span className="font-bold text-coral">{copy.chores.daysRemaining(d.days!)}</span> <span className="text-ink2">{copy.chores.remaining}</span>
    </span>
  );
}

/**
 * One chore. The title gets the whole width (it wraps instead of being cut off), when it is due and
 * who has it sit underneath, and the two actions are compact icon buttons so the card stays short.
 */
export function ChoreCard({ chore, today, assignee, completer, canDone, canEdit, blockedReason, busy, onDone, onReopen }: ChoreCardProps) {
  const completed = chore.status === 'completed';
  const overdue = !completed && dueInfo(chore.dueDate, today).kind === 'overdue';
  const doneReason = blockedReason ?? (canDone ? undefined : copy.chores.noPermissionDone);
  const editReason = blockedReason ?? (canEdit ? undefined : copy.chores.noPermissionEdit);

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-start gap-3 p-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Icon name="checklist" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold break-words text-ink-strong">{chore.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {completed ? <Chip tone="success">{copy.chores.completed}</Chip> : <Due chore={chore} today={today} />}
            {chore.recurrenceFrequency ? <Chip icon={<Icon name="swap" size={12} />}>{copy.chores.repeats[chore.recurrenceFrequency]}</Chip> : null}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <Avatar name={assignee?.displayName ?? '?'} color={assignee?.avatarColor} size="sm" />
            <span className="min-w-0 break-words text-ink2">
              {assignee ? (
                <>
                  {copy.chores.assignedTo} <b className="font-semibold text-ink">{assignee.displayName}</b>
                </>
              ) : (
                copy.chores.unassigned
              )}
            </span>
            {assignee?.status === 'leaving' ? <Chip tone="warning">{copy.chores.movingOut}</Chip> : null}
          </div>
        </div>
        {completed ? null : (
          <div className="flex shrink-0 items-center gap-1">
            {editReason ? (
              <IconButton label={copy.chores.edit} icon={<Icon name="pen" size={20} />} disabled disabledReason={editReason} />
            ) : (
              <Link to={`/chores/${chore.id}/edit`} aria-label={copy.chores.edit} title={copy.chores.edit} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-coral hover:bg-brand-soft">
                <Icon name="pen" size={20} />
              </Link>
            )}
            <IconButton
              tone="primary"
              label={busy ? copy.chores.marking : copy.chores.markDone}
              icon={<Icon name="check" size={22} />}
              aria-busy={busy || undefined}
              disabled={!!doneReason || busy}
              disabledReason={doneReason}
              onClick={onDone}
            />
          </div>
        )}
      </div>

      {overdue ? <p className="bg-sunken px-3 py-1.5 text-sm text-ink2">{copy.chores.waiting}</p> : null}
      {chore.description ? <p className="border-t border-line px-3 py-2 text-sm text-ink2">{chore.description}</p> : null}

      {completed ? (
        <div className="flex items-center gap-2 border-t border-line bg-strip px-3 py-1">
          <p className="min-w-0 flex-1 text-sm text-ink">{copy.chores.completedBy(completer ?? 'Someone', formatDay((chore.completedAt ?? '').slice(0, 10) || today))}</p>
          <Button variant="tertiary" loading={busy} onClick={onReopen} disabled={!!blockedReason} disabledReason={blockedReason ?? undefined}>
            {copy.chores.undo}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
