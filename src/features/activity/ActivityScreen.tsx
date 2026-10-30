import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { markActivityRead, markAllActivityRead, type ActivityEvent } from '@/api/activity';
import { copy } from '@/copy';
import { categoryOf, NOTIFICATION_CATEGORIES } from '@/domain';
import { errorMessage } from '@/lib/errors';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { SubPage } from '@/features/shell/SubPage';
import { Button, EmptyState, ErrorState, SkeletonList, useToast } from '@/ui';
import { ActivityFilter, type ActivityFilterValue } from './ActivityFilter';
import { ActivityList } from './ActivityList';
import { useInvalidateActivity, useNotifications } from './hooks';

/** The bell's destination: this person's updates, newest first, filterable by category, with read state. */
export function ActivityScreen() {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const feed = useNotifications();
  const invalidate = useInvalidateActivity();
  const toast = useToast();
  const [filter, setFilter] = useState<ActivityFilterValue>('all');

  const readOne = useMutation({
    mutationFn: (e: ActivityEvent) => markActivityRead(e.id),
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: () => markAllActivityRead(access!.householdId),
    onSuccess: async (n) => {
      await invalidate();
      toast.show({
        message: n > 0 ? copy.activity.markedAll : copy.activity.nothingToMark,
      });
    },
    onError: (err) => toast.show({ tone: 'error', message: errorMessage(err) }),
  });

  if (!access) return null;
  const shown = filter === 'all' ? feed.mine : feed.mine.filter((e) => categoryOf(e.eventType) === filter);
  const unreadN = feed.mine.filter((e) => !feed.readIds.has(e.id)).length;
  const hasUnread = unreadN > 0;
  const present = NOTIFICATION_CATEGORIES.filter((c) => feed.mine.some((e) => categoryOf(e.eventType) === c));

  let body;
  if (feed.isPending || dir.isPending) body = <SkeletonList rows={5} />;
  else if (feed.error) body = <ErrorState message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />;
  else if (feed.mine.length === 0) body = <EmptyState title={copy.activity.emptyTitle} body={copy.activity.emptyBody} />;
  else if (shown.length === 0) body = <EmptyState title={copy.activity.emptyTitle} body={copy.activity.emptyFiltered} />;
  else
    body = (
      <ActivityList
        label={copy.activity.title}
        events={shown}
        nameOf={dir.nameOf}
        isUnread={(e) => !feed.readIds.has(e.id)}
        onOpen={(ev) => !feed.readIds.has(ev.id) && readOne.mutate(ev)}
      />
    );

  return (
    <SubPage title={copy.activity.title} backTo="/">
      {feed.quietNow ? (
        <p role="status" className="rounded-xl border border-tint-line bg-tint p-3 text-sm text-ink">
          {copy.activity.quietNote}
        </p>
      ) : null}
      {feed.mine.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-sm text-ink2">{hasUnread ? copy.activity.unreadCount(unreadN) : copy.activity.caughtUp}</p>
          <div className="ml-auto flex items-center gap-1">
            {present.length > 1 ? <ActivityFilter present={present} value={filter} onChange={setFilter} /> : null}
            <Button
              variant="tertiary"
              className="px-3 text-sm"
              loading={readAll.isPending}
              disabled={!hasUnread}
              disabledReason={copy.activity.nothingToMark}
              onClick={() => readAll.mutate()}
            >
              {copy.activity.markAll}
            </Button>
          </div>
        </div>
      ) : null}
      {body}
    </SubPage>
  );
}
