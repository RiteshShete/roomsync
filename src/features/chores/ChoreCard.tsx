import { Link } from 'react-router-dom';
import type { Chore } from '@/api/chores';
import type { MemberWithLeft } from '@/api/households';
import { copy } from '@/copy';
import { dueInfo } from '@/domain';
import { formatDay } from '@/lib/format';
import { Avatar, Button, Chip, Icon } from '@/ui';

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

/** Due column: neutral wording. Overdue never turns red or shames anyone (spec §8.6, principle 4). */
function Due({ chore, today }: { chore: Chore; today: string }) {
  const d = dueInfo(chore.dueDate, today);
  if (d.kind === 'none') return <p className="text-sm text-ink2">{copy.chores.due.none}</p>;
  if (d.kind === 'overdue') return <p className="text-sm text-ink2">{copy.chores.wasDue(formatDay(chore.dueDate!))}</p>;
  if (d.kind === 'today') return <p className="text-xl font-bold text-coral">{copy.chores.due.today}</p>;
  if (d.kind === 'tomorrow') return <p className="text-xl font-bold text-coral">{copy.chores.due.tomorrow}</p>;
  return (
    <>
      <p className="text-xl font-bold text-coral">{copy.chores.daysRemaining(d.days!)}</p>
      <p className="text-xs text-ink2">{copy.chores.remaining}</p>
    </>
  );
}

export function ChoreCard({ chore, today, assignee, completer, canDone, canEdit, blockedReason, busy, onDone, onReopen }: ChoreCardProps) {
  const completed = chore.status === 'completed';
  const overdue = !completed && dueInfo(chore.dueDate, today).kind === 'overdue';
  const doneReason = blockedReason ?? (canDone ? undefined : copy.chores.noPermissionDone);

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 p-3">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Icon name="checklist" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg text-ink-strong">{chore.title}</p>
          {chore.recurrenceFrequency ? (
            <Chip icon={<Icon name="swap" size={12} />}>{copy.chores.repeats[chore.recurrenceFrequency]}</Chip>
          ) : null}
        </div>
        {completed ? (
          <p className="shrink-0 border-l border-line pl-3 text-lg font-bold text-success-text">{copy.chores.completed}</p>
        ) : (
          <div className="shrink-0 border-l border-line pl-3 text-right">
            <Due chore={chore} today={today} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-sm">
        <Avatar name={assignee?.displayName ?? '?'} color={assignee?.avatarColor} size="sm" />
        <span className="min-w-0 flex-1 truncate text-ink2">
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

      {overdue ? <p className="bg-sunken px-3 py-1.5 text-sm text-ink2">{copy.chores.waiting}</p> : null}
      {chore.description ? <p className="border-t border-line px-3 py-2 text-sm text-ink2">{chore.description}</p> : null}

      {completed ? (
        <div className="flex items-center gap-2 border-t border-line bg-strip px-3 py-2">
          <p className="min-w-0 flex-1 text-sm text-ink">{copy.chores.completedBy(completer ?? 'Someone', formatDay((chore.completedAt ?? '').slice(0, 10) || today))}</p>
          <Button variant="secondary" loading={busy} onClick={onReopen} disabled={!!blockedReason} disabledReason={blockedReason ?? undefined}>
            {copy.chores.undo}
          </Button>
        </div>
      ) : (
        <div className="flex gap-3 border-t border-line bg-strip p-3">
          {canEdit && !blockedReason ? (
            <Link to={`/chores/${chore.id}/edit`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 text-base font-semibold text-coral hover:bg-brand-soft">
              {copy.chores.edit}
            </Link>
          ) : (
            <Button variant="secondary" className="flex-1" disabled disabledReason={blockedReason ?? copy.chores.noPermissionEdit}>
              {copy.chores.edit}
            </Button>
          )}
          <Button
            className="flex-1"
            icon={<Icon name="check" size={18} />}
            loading={busy}
            loadingLabel={copy.chores.marking}
            disabled={!!doneReason}
            disabledReason={doneReason}
            onClick={onDone}
          >
            {copy.chores.markDone}
          </Button>
        </div>
      )}
    </li>
  );
}
