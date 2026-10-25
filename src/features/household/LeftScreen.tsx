import { Navigate, useNavigate } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { formatDay } from '@/lib/format';
import { Button, ErrorState, SkeletonList } from '@/ui';
import { dismissLeftNotice, pendingLeftNotice, useLeftHouseholds } from './useLeft';

/**
 * Shown once, right after someone has left a household: its name and when they left, and nothing
 * else (they have no access to its data). Continuing goes to the usual create-or-join screen.
 */
export function LeftScreen() {
  const navigate = useNavigate();
  const left = useLeftHouseholds(true);

  if (left.isPending || left.isFetching) return <SkeletonList rows={3} />;
  if (left.isError) return <ErrorState message={errorMessage(left.error)} onRetry={() => void left.refetch()} />;
  const household = pendingLeftNotice(left.data);
  if (!household) return <Navigate to="/start" replace />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-bold text-ink-strong">{copy.left.title(household.name)}</h1>
      <p className="text-sm text-ink2">{formatDay(household.leftAt.slice(0, 10))}</p>
      <p className="text-base text-ink">{copy.left.body}</p>
      <p className="rounded-xl border border-tint-line bg-tint p-4 text-base text-ink">{copy.left.unresolved}</p>
      <Button
        fullWidth
        onClick={() => {
          dismissLeftNotice(household.householdId);
          navigate('/start', { replace: true });
        }}
      >
        {copy.left.continue}
      </Button>
    </main>
  );
}
