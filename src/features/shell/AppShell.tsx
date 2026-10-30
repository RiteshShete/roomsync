import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { formatDay } from '@/lib/format';
import { BottomNav, ErrorState, Header, SkeletonList } from '@/ui';
import { useBell, useReminderSync } from '@/features/activity/hooks';
import { pendingLeftNotice, useLeftHouseholds, useReconcileOnOpen } from '@/features/household/useLeft';
import { useMembership } from '@/features/household/useMembership';
import { useRealtime } from './useRealtime';

/** Top-level tab pages get the shell header; pages below a tab (e.g. /you/members) bring their own. */
const TAB_TITLES: Record<string, string> = {
  '/house/groceries': copy.nav.shopping,
  '/you': copy.nav.settings,
};

/**
 * Layout for users who belong to a household: header (tab pages), archived banner, the active tab,
 * and the five-tab bottom nav. Users without a household are sent to /start.
 */
export function AppShell() {
  const membership = useMembership();
  const { pathname } = useLocation();
  const bell = useBell();
  const { justUpdated } = useRealtime(membership.data?.household.id);
  useReconcileOnOpen(membership.data?.household.id);
  // Someone with no household may just have left one: then they see "You've left ..." first.
  const left = useLeftHouseholds(membership.isSuccess && membership.data === null);
  useReminderSync(membership.data?.household.id, membership.data?.household.status === 'archived');

  if (membership.isPending) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-md pt-10">
        <SkeletonList rows={4} />
      </div>
    );
  }
  if (membership.isError) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-md pt-10">
        <ErrorState message={errorMessage(membership.error)} onRetry={() => void membership.refetch()} />
      </div>
    );
  }
  if (!membership.data) {
    // Wait for a fresh answer: a cached "nothing left" from earlier in the session must not decide this.
    if (left.isPending || left.isFetching) return <SkeletonList rows={4} />;
    return <Navigate to={pendingLeftNotice(left.data) ? '/left' : '/start'} replace />;
  }

  const isHome = pathname === '/';
  const showHeader = !isHome && pathname in TAB_TITLES; // Home draws its own panel (logo + House Feed)
  const title = TAB_TITLES[pathname] ?? copy.brand.name;
  const archived = membership.data.household.status === 'archived';

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-bg">
      {showHeader ? <Header title={title} bell={bell} /> : null}
      {archived ? (
        <p role="status" className="border-b border-line bg-warning-soft px-4 py-3 text-sm font-bold text-ink">
          {copy.settings.banner}
        </p>
      ) : null}
      {justUpdated ? (
        <p role="status" className="pointer-events-none fixed top-2 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink-strong px-3 py-1 text-xs font-bold text-surface">
          {copy.activity.updated}
        </p>
      ) : null}
      {membership.data.status === 'leaving' && membership.data.moveOutEffectiveDate ? (
        <p role="status" className="border-b border-line bg-warning-soft px-4 py-3 text-sm font-bold text-ink">
          {copy.moveOut.banner(formatDay(membership.data.moveOutEffectiveDate))}{' '}
          <Link to="/you/household/leave" className="underline">
            {copy.moveOut.bannerLink}
          </Link>
        </p>
      ) : null}
      <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
