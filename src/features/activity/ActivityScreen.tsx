import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { markActivityRead, markAllActivityRead, type ActivityEvent } from '@/api/activity';
import { copy } from '@/copy';
import { categoryOf, NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/domain';
import { errorMessage } from '@/lib/errors';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { SubPage } from '@/features/shell/SubPage';
import { Button, EmptyState, ErrorState, SkeletonList, useToast } from '@/ui';
import { ActivityRow } from './ActivityRow';
import { useInvalidateActivity, useNotifications } from './hooks';

type Filter = 'all' | NotificationCategory;

/** The bell's destination: this person's updates, newest first, filterable by category, with read state. */
export function ActivityScreen() {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const feed = useNotifications();
  const invalidate = useInvalidateActivity();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');

  const readOne = useMutation({ mutationFn: (e: ActivityEvent) => markActivityRead(e.id), onSuccess: invalidate });
  const readAll = useMutation({
    mutationFn: () => markAllActivityRead(access!.householdId),
    onSuccess: async (n) => {
      await invalidate();
      toast.show({ message: n > 0 ? copy.activity.markedAll : copy.activity.nothingToMark });
    },
    onError: (err) => toast.show({ tone: 'error', message: errorMessage(err) }),
  });

  if (!access) return null;
  const shown = filter === 'all' ? feed.mine : feed.mine.filter((e) => categoryOf(e.eventType) === filter);
  const hasUnread = feed.mine.some((e) => !feed.readIds.has(e.id));
  const present = NOTIFICATION_CATEGORIES.filter((c) => feed.mine.some((e) => categoryOf(e.eventType) === c));

  let body;
  if (feed.isPending || dir.isPending) body = <SkeletonList rows={5} />;
  else if (feed.error) body = <ErrorState message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />;
  else if (feed.mine.length === 0) body = <EmptyState title={copy.activity.emptyTitle} body={copy.activity.emptyBody} />;
  else if (shown.length === 0) body = <EmptyState title={copy.activity.emptyTitle} body={copy.activity.emptyFiltered} />;
  else
    body = (
      <ul aria-label={copy.activity.title} className="overflow-hidden rounded-xl border border-line bg-surface">
        {shown.map((e) => (
          <ActivityRow key={e.id} event={e} nameOf={dir.nameOf} unread={!feed.readIds.has(e.id)} onOpen={(ev) => !feed.readIds.has(ev.id) && readOne.mutate(ev)} />
        ))}
      </ul>
    );

  return (
    <SubPage title={copy.activity.title} backTo="/">
      {feed.quietNow ? (
        <p role="status" className="rounded-xl border border-tint-line bg-tint p-3 text-sm text-ink">
          {copy.activity.quietNote}
        </p>
      ) : null}
      {present.length > 1 ? (
        <div role="group" aria-label={copy.activity.categoriesLabel} className="flex flex-wrap gap-2">
          {(['all', ...present] as Filter[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold ${filter === c ? 'border-primary bg-brand-soft text-coral' : 'border-line bg-surface text-ink'}`}
            >
              {c === 'all' ? copy.activity.all : copy.activity.categories[c]}
            </button>
          ))}
        </div>
      ) : null}
      {feed.mine.length > 0 ? (
        <Button variant="secondary" fullWidth loading={readAll.isPending} disabled={!hasUnread} disabledReason={copy.activity.nothingToMark} showReason onClick={() => readAll.mutate()}>
          {copy.activity.markAll}
        </Button>
      ) : null}
      {body}
    </SubPage>
  );
}
