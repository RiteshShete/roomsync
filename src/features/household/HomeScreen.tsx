import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { RecentActivity } from '@/features/activity/RecentActivity';
import { AvatarGroup, ErrorState, SkeletonList } from '@/ui';
import { useHouseholdAccess, useMembers } from './useMembership';

const QUICK_ADD = [
  { to: '/expenses/new', label: copy.home.addExpense },
  { to: '/chores/new', label: copy.home.addChore },
  { to: '/house/groceries', label: copy.home.addGrocery },
];

/** Home (spec §8.4): who lives here, quick shortcuts to add things, and the latest updates. */
export function HomeScreen() {
  const access = useHouseholdAccess();
  const members = useMembers(access?.householdId);

  if (members.isPending) return <SkeletonList rows={3} />;
  if (members.isError) return <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} />;

  const alone = members.data.length === 1;
  return (
    <div className="flex flex-col gap-5 p-4">
      <section aria-labelledby="home-members" className="flex flex-col gap-3 rounded-xl border border-tint-line bg-tint p-4">
        <h2 id="home-members" className="text-lg font-bold text-ink">
          {copy.home.members}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <AvatarGroup members={members.data.map((m) => ({ name: m.displayName, color: m.avatarColor }))} size="md" />
          <p className="text-sm font-semibold text-ink">{members.data.length === 1 ? '1 member' : `${members.data.length} members`}</p>
        </div>
        {alone ? <p className="text-base text-ink2">{copy.home.alone}</p> : null}
        {alone && access?.isAdmin ? (
          <Link
            to="/you/invites"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-primary px-5 text-base font-bold text-on-primary hover:bg-primary-pressed"
          >
            {copy.home.inviteCta}
          </Link>
        ) : null}
      </section>

      <nav aria-label={copy.home.quickAdd} className="grid grid-cols-3 gap-2">
        {QUICK_ADD.map((q) => (
          <Link key={q.to} to={q.to} className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-2 text-center text-sm font-bold text-coral hover:bg-brand-soft">
            {q.label}
          </Link>
        ))}
      </nav>

      <RecentActivity />
    </div>
  );
}
