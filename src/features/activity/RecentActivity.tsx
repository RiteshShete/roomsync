import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { categoryOf, NOTIFICATION_CATEGORIES } from '@/domain';
import { errorMessage } from '@/lib/errors';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { EmptyState, ErrorState, SkeletonList } from '@/ui';
import { ActivityFilter, type ActivityFilterValue } from './ActivityFilter';
import { ActivityList } from './ActivityList';
import { useNotifications } from './hooks';

const SHOWN = 20;

/**
 * Home → Activity, from the design: an underlined "Activity" tab with a Filter menu on its right, then
 * the latest updates addressed to this person grouped by day, linking to the full list. (The design's
 * Message tab is not built: no chat for now.)
 */
export function RecentActivity({ tabs }: { tabs: ReactNode }) {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const feed = useNotifications();
  const [filter, setFilter] = useState<ActivityFilterValue>('all');

  const present = NOTIFICATION_CATEGORIES.filter((c) => feed.mine.some((e) => categoryOf(e.eventType) === c));
  const shown = (filter === 'all' ? feed.mine : feed.mine.filter((e) => categoryOf(e.eventType) === filter)).slice(0, SHOWN);

  let body;
  if (feed.isPending || dir.isPending) body = <SkeletonList rows={3} />;
  else if (feed.error) body = <ErrorState message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />;
  else if (feed.mine.length === 0) body = <EmptyState title={copy.home.emptyTitle} body={copy.home.emptyBody} />;
  else if (shown.length === 0) body = <EmptyState title={copy.activity.emptyTitle} body={copy.activity.emptyFiltered} />;
  else body = <ActivityList label={copy.activity.recent} events={shown} nameOf={dir.nameOf} isUnread={(e) => !feed.readIds.has(e.id)} />;

  return (
    <section aria-labelledby="home-recent" className="flex flex-col gap-3">
      <h2 id="home-recent" className="sr-only">
        {copy.activity.recent}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line">
        {tabs}
        {present.length > 1 ? <ActivityFilter present={present} value={filter} onChange={setFilter} /> : null}
      </div>
      {body}
      <Link to="/activity" className="inline-flex min-h-11 items-center justify-center text-sm font-bold text-coral">
        {copy.activity.seeAll}
      </Link>
    </section>
  );
}
