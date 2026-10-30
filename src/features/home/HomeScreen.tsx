import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { RecentActivity } from '@/features/activity/RecentActivity';
import { useBell } from '@/features/activity/hooks';
import { useHouseholdAccess, useMembers } from '@/features/household/useMembership';
import { BellButton, BrandMark, ErrorState, SkeletonList } from '@/ui';
import { HouseFeed } from './HouseFeed';

/**
 * Home, from the design: the RoomSync mark and name, the House Feed card, and below it the household's
 * activity. (The design's chat tab and message box, and its points line, are not built: no chat for now,
 * no points.) The household's name is the page's heading for screen readers.
 */
export function HomeScreen() {
  const access = useHouseholdAccess();
  const members = useMembers(access?.householdId);
  const bell = useBell();
  if (!access) return null;

  return (
    <div>
      <h1 className="sr-only">{access.householdName}</h1>
      <div className="rounded-b-2xl border-b border-line bg-surface px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-6">
        <div className="mb-4 flex items-center gap-3">
          <BrandMark size={40} />
          {/* The wordmark is part of the logo, in the brand coral from the design. WCAG 1.4.3 exempts logotypes from the contrast minimum, so the accessibility scan skips [data-logotype]. */}
          <p aria-hidden="true" data-logotype className="min-w-0 flex-1 truncate text-xl font-extrabold text-primary">
            {copy.brand.name}
          </p>
          <BellButton unread={bell.unread} onClick={bell.onClick} />
        </div>
        {members.isError ? <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} /> : members.isPending ? <SkeletonList rows={2} /> : <HouseFeed />}
      </div>
      <div className="p-4">
        <RecentActivity />
      </div>
    </div>
  );
}
