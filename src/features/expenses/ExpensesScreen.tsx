import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, EmptyState, ErrorState, Fab, SkeletonList } from '@/ui';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { ExpenseCard } from './ExpenseCard';
import { MoneyHeader } from './MoneyHeader';
import { useDirectory } from '@/features/household/useDirectory';
import { useBalances, useExpenses, useMoney } from './hooks';

const LINK =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-3 text-base font-semibold text-coral hover:bg-brand-soft';

/**
 * Expenses tab: what you owe and are owed (never a single "house balance"), recent expenses, and a
 * floating "+" to add one. Loading, empty, error and success states for each part.
 */
export function ExpensesScreen() {
  const access = useHouseholdAccess();
  const { fmt } = useMoney();
  const dir = useDirectory(access?.householdId);
  const balances = useBalances(access?.householdId);
  const recent = useExpenses(access?.householdId, {});

  if (!access) return null;
  const mine = balances.data?.find((b) => b.memberId === access.memberId)?.netMinor ?? 0;
  const owe = mine < 0 ? -mine : 0;
  const owed = mine > 0 ? mine : 0;
  const items = recent.data?.pages[0]?.items.slice(0, 5) ?? [];
  const avatarOf = (id: string) => dir.member(id)?.avatarColor;

  let list;
  if (recent.isPending || dir.isPending) list = <SkeletonList rows={3} />;
  else if (recent.isError) list = <ErrorState message={errorMessage(recent.error)} onRetry={() => void recent.refetch()} />;
  else if (dir.isError) list = <ErrorState message={errorMessage(dir.error)} onRetry={() => void dir.refetch()} />;
  else if (items.length === 0)
    list = (
      <EmptyState
        title={copy.expenses.emptyTitle}
        body={copy.expenses.emptyBody}
        action={
          <Link to="/expenses/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-pressed">
            {copy.expenses.addExpense}
          </Link>
        }
      />
    );
  else
    list = (
      <ul className="flex flex-col gap-3">
        {items.map((e) => (
          <li key={e.id}>
            <ExpenseCard expense={e} fmt={fmt} nameOf={dir.nameOf} avatarOf={avatarOf} myMemberId={access.memberId} />
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <MoneyHeader />
      <div className="flex flex-col gap-4 p-4 pb-24">
        <section aria-label={copy.expenses.title} className="rounded-xl border border-line bg-surface p-4">
          {balances.isPending ? (
            <SkeletonList rows={1} />
          ) : balances.isError ? (
            <ErrorState message={errorMessage(balances.error)} onRetry={() => void balances.refetch()} />
          ) : (
            <>
              <div className="grid grid-cols-2 divide-x divide-line">
                <div className="pr-3">
                  <p className="text-sm text-ink2">{copy.expenses.youOwe}</p>
                  <p data-testid="you-owe" className={`text-2xl font-bold ${owe > 0 ? 'text-danger' : 'text-ink'}`}>
                    {fmt(owe)}
                  </p>
                </div>
                <div className="pl-3">
                  <p className="text-sm text-ink2">{copy.expenses.youAreOwed}</p>
                  <p data-testid="you-are-owed" className={`text-2xl font-bold ${owed > 0 ? 'text-success' : 'text-ink'}`}>
                    {fmt(owed)}
                  </p>
                </div>
              </div>
              {owe === 0 && owed === 0 ? <p className="mt-3 text-sm text-ink2">{copy.expenses.allSettled}</p> : null}
            </>
          )}
          <div className="mt-4 flex gap-3">
            <Link to="/expenses/balances" className={LINK}>
              {copy.expenses.reviewBalances}
            </Link>
            {access.writeBlockedReason ? (
              <Button variant="secondary" className="flex-1" disabled disabledReason={access.writeBlockedReason}>
                {copy.expenses.recordSettlement}
              </Button>
            ) : (
              <Link to="/expenses/settle" className={LINK}>
                {copy.expenses.recordSettlement}
              </Link>
            )}
          </div>
        </section>

        {items.length > 0 ? (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">{copy.expenses.recent}</h2>
            <Link to="/expenses/all" className="inline-flex min-h-11 items-center font-semibold text-coral underline-offset-4 hover:underline">
              {copy.expenses.viewAll}
            </Link>
          </div>
        ) : null}
        {list}
      </div>
      <Fab to="/expenses/new" label={copy.expenses.addExpense} disabledReason={access.writeBlockedReason ?? undefined} />
    </>
  );
}
