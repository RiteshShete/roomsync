import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { completeChore, reopenChore, type Chore, type CompleteResult } from '@/api/chores';
import { copy } from '@/copy';
import { choreBucket } from '@/domain';
import { errorMessage, toAppError } from '@/lib/errors';
import { useDirectory } from '@/features/household/useDirectory';
import { todayIso } from '@/domain';
import { useSession } from '@/features/auth/Session';
import { TabbedHeader } from '@/features/shell/TabbedHeader';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { EmptyState, ErrorState, Fab, SkeletonList, useToast } from '@/ui';
import { ChoreCard } from './ChoreCard';
import { useChores, useInvalidateChores } from './hooks';

type Tab = 'today' | 'upcoming' | 'completed';

/** Chores in three lists: Today (due or still waiting), Upcoming (later or undated), Completed (history). */
export function ChoresScreen({ tab }: { tab: Tab }) {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const chores = useChores(access?.householdId);
  const session = useSession();
  const toast = useToast();
  const invalidate = useInvalidateChores();
  const today = todayIso();
  const myUserId = session.status === 'signedIn' ? session.user.id : null;

  const reopen = useMutation({
    mutationFn: (c: Chore) => reopenChore(c.id),
    onSuccess: async () => {
      await invalidate();
      toast.show({ message: copy.chores.reopened });
    },
    onError: (err) => toast.show({ tone: 'error', message: errorMessage(err) }),
  });

  const done = useMutation({
    mutationFn: (c: Chore) => completeChore(c.id, c.version),
    onSuccess: async (r: CompleteResult, c) => {
      await invalidate();
      const parts: string[] = [copy.chores.done];
      if (r.nextAssigneeMemberId) parts.push(copy.chores.nextUp(dir.nameOf(r.nextAssigneeMemberId)));
      else if (r.nextChoreId && (c.rotationMemberIds || c.assigneeMemberId)) parts.push(copy.chores.unassignedNext);
      if (r.skippedMemberIds.length > 0) parts.push(copy.chores.skipped(r.skippedMemberIds.map(dir.nameOf).join(', ')));
      toast.show({ message: parts.join(' '), action: { label: copy.chores.undo, onClick: () => reopen.mutate(c) } });
    },
    onError: async (err) => {
      if (toAppError(err).code === 'conflict') {
        await invalidate();
        toast.show({ tone: 'error', message: copy.chores.conflictDone });
      } else toast.show({ tone: 'error', message: errorMessage(err) });
    },
  });

  if (!access) return null;
  const open = chores.data?.open ?? [];
  const todayList = open.filter((c) => choreBucket(c.dueDate, today) === 'today');
  const upcomingList = open.filter((c) => choreBucket(c.dueDate, today) === 'upcoming');
  const completedList = chores.data?.completed ?? [];
  const tabs = [
    { to: '/chores', label: `${copy.chores.today} (${todayList.length})`, end: true },
    { to: '/chores/upcoming', label: `${copy.chores.upcoming} (${upcomingList.length})` },
    { to: '/chores/completed', label: `${copy.chores.completed} (${completedList.length})` },
  ];
  const list = tab === 'today' ? todayList : tab === 'upcoming' ? upcomingList : completedList;

  const canDone = (c: Chore) => access.isAdmin || c.createdBy === myUserId || c.assigneeMemberId === access.memberId || c.assigneeMemberId === null;
  const canEdit = (c: Chore) => access.isAdmin || c.createdBy === myUserId || c.assigneeMemberId === access.memberId;

  let body;
  if (chores.isPending || dir.isPending) body = <SkeletonList rows={3} />;
  else if (chores.isError) body = <ErrorState message={errorMessage(chores.error)} onRetry={() => void chores.refetch()} />;
  else if (dir.isError) body = <ErrorState message={errorMessage(dir.error)} onRetry={() => void dir.refetch()} />;
  else if (open.length === 0 && completedList.length === 0)
    body = (
      <EmptyState
        title={copy.chores.emptyTitle}
        body={copy.chores.emptyBody}
        action={
          access.writeBlockedReason ? undefined : (
            <Link to="/chores/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-pressed">
              {copy.chores.create}
            </Link>
          )
        }
      />
    );
  else if (list.length === 0) {
    const e = tab === 'today' ? [copy.chores.emptyToday, copy.chores.emptyTodayBody] : tab === 'upcoming' ? [copy.chores.emptyUpcoming, copy.chores.emptyUpcomingBody] : [copy.chores.emptyCompleted, copy.chores.emptyCompletedBody];
    body = <EmptyState title={e[0]!} body={e[1]} />;
  } else
    body = (
      <ul className="flex flex-col gap-3">
        {list.map((c) => (
          <ChoreCard
            key={c.id}
            chore={c}
            today={today}
            assignee={c.assigneeMemberId ? dir.member(c.assigneeMemberId) : undefined}
            completer={dir.nameOfUser(c.completedBy)}
            canDone={canDone(c)}
            canEdit={canEdit(c)}
            blockedReason={access.writeBlockedReason}
            busy={(done.isPending && done.variables?.id === c.id) || (reopen.isPending && reopen.variables?.id === c.id)}
            onDone={() => done.mutate(c)}
            onReopen={() => reopen.mutate(c)}
          />
        ))}
      </ul>
    );

  return (
    <>
      <TabbedHeader title={copy.chores.title} tabs={tabs} />
      <div className="p-4 pb-24">{body}</div>
      <Fab to="/chores/new" label={copy.chores.create} disabledReason={access.writeBlockedReason ?? undefined} />
    </>
  );
}
