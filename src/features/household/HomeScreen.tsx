import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { AvatarGroup, Button, EmptyState, ErrorState, SkeletonList } from '@/ui';
import { useHouseholdAccess, useMembers } from './useMembership';

/**
 * Home skeleton (spec §8.4): who lives here, then the "Your house is ready" empty state. The
 * expense/chore/grocery shortcuts arrive with their own phases, so that button says why it's off.
 */
export function HomeScreen() {
  const access = useHouseholdAccess();
  const members = useMembers(access?.householdId);

  if (members.isPending) return <SkeletonList rows={3} />;
  if (members.isError) return <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} />;

  const alone = members.data.length === 1;
  return (
    <div className="flex flex-col gap-4 p-4">
      <section aria-labelledby="home-members" className="flex flex-col gap-3 rounded-3xl border-2 border-tint bg-tint p-4">
        <h2 id="home-members" className="text-lg font-extrabold text-ink">
          {copy.home.members}
        </h2>
        <div className="flex items-center gap-3">
          <AvatarGroup members={members.data.map((m) => ({ name: m.displayName, color: m.avatarColor }))} size="md" />
          <p className="text-sm font-semibold text-ink">{members.data.length === 1 ? '1 member' : `${members.data.length} members`}</p>
        </div>
        {alone ? <p className="text-base text-ink2">{copy.home.alone}</p> : null}
        {alone && access?.isAdmin ? (
          <Link
            to="/you/invites"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border-2 border-transparent bg-primary px-5 text-base font-bold text-on-primary hover:bg-primary-pressed"
          >
            {copy.home.inviteCta}
          </Link>
        ) : null}
      </section>

      <EmptyState
        title={copy.home.emptyTitle}
        body={copy.home.emptyBody}
        action={
          <Button disabled disabledReason={copy.home.emptyCtaReason} showReason>
            {copy.home.emptyCta}
          </Button>
        }
      />
    </div>
  );
}
