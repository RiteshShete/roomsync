import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { EmptyState, ErrorState, SkeletonList } from '@/ui';
import { ActivityRow } from './ActivityRow';
import { useNotifications } from './hooks';

const SHOWN = 5;

/** Home → "Recent activity": the latest few updates addressed to this person, linking to the full list. */
export function RecentActivity() {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const feed = useNotifications();

  let body;
  if (feed.isPending || dir.isPending) body = <SkeletonList rows={3} />;
  else if (feed.error) body = <ErrorState message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />;
  else if (feed.mine.length === 0) body = <EmptyState title={copy.home.emptyTitle} body={copy.home.emptyBody} />;
  else
    body = (
      <ul aria-label={copy.activity.recent} className="overflow-hidden rounded-xl border border-line bg-surface">
        {feed.mine.slice(0, SHOWN).map((e) => (
          <ActivityRow key={e.id} event={e} nameOf={dir.nameOf} unread={!feed.readIds.has(e.id)} />
        ))}
      </ul>
    );

  return (
    <section aria-labelledby="home-recent" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-recent" className="text-lg font-bold text-ink">
          {copy.activity.recent}
        </h2>
        <Link to="/activity" className="inline-flex min-h-11 items-center text-sm font-bold text-coral">
          {copy.activity.seeAll}
        </Link>
      </div>
      {body}
    </section>
  );
}
