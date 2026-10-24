import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { BottomNav, ErrorState, Header, SkeletonList } from '@/ui';
import { useMembership } from '@/features/household/useMembership';

/** Top-level tab pages get the shell header; pages below a tab (e.g. /you/members) bring their own. */
const TAB_TITLES: Record<string, string> = {
  '/expenses': copy.nav.expenses,
  '/chores': copy.nav.chores,
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
      {showHeader ? <Header title={title} brand={isHome} bell={{ disabledReason: copy.header.notificationsUnavailable }} /> : null}
      {archived ? (
        <p role="status" className="border-b border-line bg-warning-soft px-4 py-3 text-sm font-bold text-ink">
          {copy.settings.banner}
        </p>
      ) : null}
      <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
