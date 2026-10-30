import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { completeChore, reopenChore, type Chore, type CompleteResult } from '@/api/chores';
import { copy } from '@/copy';
import { errorMessage, toAppError } from '@/lib/errors';
import { useDirectory } from '@/features/household/useDirectory';
import { todayIso } from '@/domain';
import { useSession } from '@/features/auth/Session';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { EmptyState, ErrorState, Fab, Header, HeaderTabs, ShareButton, SkeletonList, TabLink, useToast } from '@/ui';
import { ChoreCard } from './ChoreCard';
import { useChores, useInvalidateChores } from './hooks';
import { shareTasksText } from './shareText';

type Tab = 'all' | 'mine' | 'completed';

const pad = (n: number) => String(n).padStart(2, '0');

/** Tasks, from the design: All open tasks, the ones that are yours, and Completed (history), each with a count. */
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
      const parts: string[] = [copy.chores.doneToast];
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
  const mineList = open.filter((c) => c.assigneeMemberId === access.memberId);
  const completedList = chores.data?.completed ?? [];
  const tabs = [
    { to: '/chores', label: copy.chores.tabAll, count: `(${pad(open.length)})`, end: true },
    { to: '/chores/mine', label: copy.chores.tabMine, count: `(${pad(mineList.length)})` },
    { to: '/chores/completed', label: copy.chores.completed, count: `(${pad(completedList.length)})` },
  ];
  const list = tab === 'all' ? open : tab === 'mine' ? mineList : completedList;

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
    const e = tab === 'all' ? [copy.chores.emptyTitle, copy.chores.emptyBody] : tab === 'mine' ? [copy.chores.emptyMine, copy.chores.emptyMineBody] : [copy.chores.emptyCompleted, copy.chores.emptyCompletedBody];
    body = <EmptyState title={e[0]!} body={e[1]} />;
  } else
    body = (
      <ul className="flex flex-col gap-5">
        {list.map((c) => (
          <ChoreCard
            key={c.id}
            chore={c}
            today={today}
            assignee={c.assigneeMemberId ? dir.member(c.assigneeMemberId) : undefined}
            myMemberId={access.memberId}
            completer={dir.members.find((m) => m.userId === c.completedBy)}
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
      <Header title={copy.chores.title} right={<ShareButton label={copy.chores.shareLabel} title={copy.chores.shareTitle} build={() => shareTasksText(copy.chores.shareTitle, list, dir.nameOf)} />}>
        <HeaderTabs label={copy.chores.title}>
          {tabs.map((t) => (
            <TabLink key={t.to} to={t.to} end={t.end} label={t.label} count={t.count} />
          ))}
        </HeaderTabs>
      </Header>
      <div className="p-4 pb-24">{body}</div>
      <Fab to="/chores/new" label={copy.chores.create} disabledReason={access.writeBlockedReason ?? undefined} />
    </>
  );
}
