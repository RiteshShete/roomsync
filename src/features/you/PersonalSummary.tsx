import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { useChores } from '@/features/chores/hooks';
import { useBalances, useMoney } from '@/features/expenses/hooks';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { SkeletonList } from '@/ui';

/** You → "Your summary": what you owe or are owed and how many chores are waiting on you. No rankings. */
export function PersonalSummary() {
  const access = useHouseholdAccess();
  const balances = useBalances(access?.householdId);
  const chores = useChores(access?.householdId);
  const { fmt } = useMoney();
  if (!access) return null;

  const failed = balances.error ?? chores.error;
  if (failed) {
    return (
      <p role="alert" className="rounded-xl border border-danger bg-danger-soft p-4 text-sm font-semibold text-ink">
        {copy.you.summaryError} {errorMessage(failed)}
      </p>
    );
  }
  if (!balances.data || !chores.data) return <SkeletonList rows={1} />;

  const net = balances.data.find((b) => b.memberId === access.memberId)?.netMinor ?? 0;
  const mine = chores.data.open.filter((c) => c.assigneeMemberId === access.memberId).length;
  return (
    <section aria-labelledby="you-summary" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="you-summary" className="text-lg font-bold text-ink">
        {copy.you.summaryTitle}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs text-ink2">{copy.you.summaryOwe}</dt>
          <dd className="text-lg font-bold text-ink-strong">{fmt(net < 0 ? -net : 0)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink2">{copy.you.summaryOwed}</dt>
          <dd className="text-lg font-bold text-success-text">{fmt(net > 0 ? net : 0)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink2">{copy.you.summaryChores}</dt>
          <dd className="text-lg font-bold text-ink-strong">{mine}</dd>
        </div>
      </dl>
    </section>
  );
}
