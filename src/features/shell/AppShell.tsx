import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { BottomNav, ErrorState, Header, SkeletonList } from '@/ui';
import { useBell, useReminderSync } from '@/features/activity/hooks';
import { useMembership } from '@/features/household/useMembership';
import { useRealtime } from './useRealtime';

/** Top-level tab pages get the shell header; pages below a tab (e.g. /you/members) bring their own. */
const TAB_TITLES: Record<string, string> = {
  '/house': copy.nav.house,
  '/you': copy.nav.you,
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
  if (!membership.data) return <Navigate to="/start" replace />;

  const isHome = pathname === '/';
  const showHeader = isHome || pathname in TAB_TITLES;
  const title = isHome ? membership.data.household.name : (TAB_TITLES[pathname] ?? copy.brand.name);
  const archived = membership.data.household.status === 'archived';

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-bg">
      {showHeader ? <Header title={title} brand={isHome} bell={bell} /> : null}
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
      <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
