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
  myMemberId: string;
  completer?: MemberWithLeft;
  canDone: boolean;
  canEdit: boolean;
  /** Set when every write is off (archived household). */
  blockedReason: string | null;
  busy: boolean;
  onDone: () => void;
  onReopen: () => void;
}

/** A thin vertical rule between the cells of a card row, as in the design. */
const Rule = ({ h }: { h: string }) => <span aria-hidden="true" className={`w-px shrink-0 bg-line ${h}`} />;

/** When it is due, in the card's right-hand block. Neutral wording: overdue never turns red or shames anyone (spec §8.6). */
function Due({ chore, today }: { chore: Chore; today: string }) {
  const d = dueInfo(chore.dueDate, today);
  if (d.kind === 'none') return <span className="text-sm text-ink2">{copy.chores.due.none}</span>;
  if (d.kind === 'overdue') return <span className="text-sm text-ink2">{copy.chores.wasDue(formatDay(chore.dueDate!))}</span>;
  if (d.kind === 'today' || d.kind === 'tomorrow') return <span className="text-xl font-extrabold text-coral">{d.kind === 'today' ? copy.chores.due.today : copy.chores.due.tomorrow}</span>;
  return (
    <>
      <span className="block text-xl font-extrabold whitespace-nowrap text-coral">{copy.chores.daysRemaining(d.days!)}</span>
      <span className="block text-xs font-medium text-ink2">{copy.chores.remaining}</span>
    </>
  );
}

/**
 * One task, from the design: a peach-bordered card with the category tile, title and category, a rule and
 * when it is due; a rule; who has it and how often it repeats; and a tinted strip with Edit and Done. A
 * completed task shows who finished it and when, with Undo. (The design's points and "I will help" have no
 * feature behind them, so they are not drawn.)
 */
export function ChoreCard({ chore, today, assignee, myMemberId, completer, canDone, canEdit, blockedReason, busy, onDone, onReopen }: ChoreCardProps) {
  const completed = chore.status === 'completed';
  const overdue = !completed && dueInfo(chore.dueDate, today).kind === 'overdue';
  const doneReason = blockedReason ?? (canDone ? undefined : copy.chores.noPermissionDone);
  const editReason = blockedReason ?? (canEdit ? undefined : copy.chores.noPermissionEdit);
  const youAre = (m: MemberWithLeft | undefined) => (m?.memberId === myMemberId ? copy.balances.you : m?.displayName);
  const completedOn = formatDay((chore.completedAt ?? '').slice(0, 10) || today);
  const person = (m: MemberWithLeft | undefined, lead: string, fallback: string) => (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar name={m?.displayName ?? '?'} color={m?.avatarColor} size="sm" className="!h-7 !w-7" />
      <span className="min-w-0 text-xs break-words text-ink">
        {m ? (
          <>
            {lead} <b className="font-bold text-ink-strong">{youAre(m)}</b>
          </>
        ) : (
          fallback
        )}
      </span>
    </span>
  );

  return (
    <li className="overflow-hidden rounded-xl border border-peach-line bg-surface">
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-[7px]">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[7px] bg-primary/12 text-primary">
              <Icon name={chore.category === 'shopping' ? 'cart' : 'checklist'} size={26} />
            </span>
            <div className="min-w-0">
              <p className="text-xl leading-tight font-semibold tracking-[-0.2px] break-words text-ink">{chore.title}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-success-text">
                {chore.category ? <span>{copy.chores.categories[chore.category]}</span> : null}
                {chore.priority === 'high' ? <Chip tone="danger">{copy.chores.highPriority}</Chip> : null}
              </p>
            </div>
          </div>
          <Rule h="h-[38px]" />
          <div className="shrink-0 text-center">{completed ? <span className="text-xl font-extrabold text-success-text">{copy.chores.completed}</span> : <Due chore={chore} today={today} />}</div>
        </div>

        <span aria-hidden="true" className="h-px w-full bg-line" />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2">
          {person(assignee, copy.chores.assignedTo, copy.chores.unassigned)}
          {chore.recurrenceFrequency ? (
            <>
              <Rule h="h-[23px]" />
              <span className="flex items-center text-xs font-semibold text-ink">
                <Icon name="swap" size={18} className="mr-1 text-ink" />
                {copy.chores.repeats[chore.recurrenceFrequency]}
              </span>
            </>
          ) : null}
          {assignee?.status === 'leaving' ? <Chip tone="warning">{copy.chores.movingOut}</Chip> : null}
        </div>
      </div>

      {/* The due block already says "Was due …"; the calm sentence stays for screen readers so the card stays short. */}
      {overdue ? <p className="sr-only">{copy.chores.waiting}</p> : null}
      {chore.description ? <p className="border-t border-peach-line px-4 py-2 text-sm text-ink2">{chore.description}</p> : null}

      {completed ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-peach-line bg-strip px-4 py-2">
          {person(completer, copy.chores.completedByLabel, 'Someone')}
          <Rule h="h-[23px]" />
          <span className="flex items-center gap-1.5 text-xs text-ink">
            <Icon name="calendar" size={16} />
            {completedOn}
          </span>
          <Button variant="tertiary" className="px-2" loading={busy} onClick={onReopen} disabled={!!blockedReason} disabledReason={blockedReason ?? undefined}>
            {copy.chores.undo}
          </Button>
        </div>
      ) : (
        <div className="flex justify-between gap-4 border-t border-peach-line bg-strip px-4 py-3">
          {editReason ? (
            <Button variant="secondary" className="min-h-11 flex-1 !rounded-[7px] border-transparent !px-2 text-sm font-medium" disabled disabledReason={editReason}>
              {copy.chores.edit}
            </Button>
          ) : (
            <Link
              to={`/chores/${chore.id}/edit`}
              aria-label={copy.chores.edit}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[7px] bg-surface px-2 text-sm font-medium text-coral hover:bg-brand-soft"
            >
              {copy.chores.edit}
            </Link>
          )}
          <Button
            className="min-h-11 flex-1 !rounded-[6px] !px-2 text-sm"
            aria-label={busy ? copy.chores.marking : copy.chores.markDone}
            icon={<Icon name="check" size={16} />}
            aria-busy={busy || undefined}
            disabled={!!doneReason || busy}
            disabledReason={doneReason}
            onClick={onDone}
          >
            {copy.chores.done}
          </Button>
        </div>
      )}
    </li>
  );
}
