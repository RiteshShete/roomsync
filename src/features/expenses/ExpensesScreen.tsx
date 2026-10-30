import { useState } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { EmptyState, ErrorState, Fab, Header, HeaderTabs, MenuButton, ShareButton, SkeletonList, TabLink } from '@/ui';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { ExpenseCard } from './ExpenseCard';
import { categoryLabel } from './categories';
import { useAllExpenses, useMoney } from './hooks';
import { shareExpensesText, sortExpenses, toPay, toReceive, type ExpenseSort, type MoneyTab } from './tabsModel';

const pad = (n: number) => String(n).padStart(2, '0');

const PILLS = [
  { to: '/expenses/balances', label: copy.expenses.balancesLink },
  { to: '/expenses/settlements', label: copy.expenses.settlementsLink },
  { to: '/expenses/all', label: copy.expenses.allLink },
];

/**
 * Expenses tab, from the design: "To Pay" (others paid and I owe a share) and "To Receive" (I paid and
 * others owe), each with a count, Filter and Sort on the right, expense cards, and a floating "+". The
 * balances, settlements and full filtered list are one tap away in the pill row.
 */
export function ExpensesScreen({ tab }: { tab: MoneyTab }) {
  const access = useHouseholdAccess();
  const { fmt } = useMoney();
  const dir = useDirectory(access?.householdId);
  const all = useAllExpenses(access?.householdId);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<ExpenseSort>('newest');

  if (!access) return null;
  const me = access.memberId;
  const pay = toPay(all.items, me);
  const receive = toReceive(all.items, me);
  const inTab = tab === 'pay' ? pay : receive;
  const shown = sortExpenses(category === '' ? inTab : inTab.filter((e) => e.category === category), sort);
  const categories = [...new Set(inTab.map((e) => e.category))];
  const avatarOf = (id: string) => dir.member(id)?.avatarColor;
  const counts = { pay: all.isLoadingAll ? null : pay.length, receive: all.isLoadingAll ? null : receive.length };

  let list;
  if (all.isPending || dir.isPending) list = <SkeletonList rows={3} />;
  else if (all.isError) list = <ErrorState message={errorMessage(all.error)} onRetry={() => void all.refetch()} />;
  else if (dir.isError) list = <ErrorState message={errorMessage(dir.error)} onRetry={() => void dir.refetch()} />;
  else if (all.items.filter((e) => e.deletedAt === null).length === 0)
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
  else if (shown.length === 0) list = <EmptyState title={tab === 'pay' ? copy.expenses.emptyPay : copy.expenses.emptyReceive} body={category !== '' ? copy.expenses.noMatchesBody : tab === 'pay' ? copy.expenses.emptyPayBody : copy.expenses.emptyReceiveBody} />;
  else
    list = (
      <ul className="flex flex-col gap-3">
        {shown.map((e) => (
          <li key={e.id}>
            <ExpenseCard expense={e} fmt={fmt} nameOf={dir.nameOf} avatarOf={avatarOf} myMemberId={me} showPay={tab === 'pay'} />
          </li>
        ))}
      </ul>
    );

  const tabs = [
    { to: '/expenses', label: copy.expenses.toPay, n: counts.pay, end: true },
    { to: '/expenses/receive', label: copy.expenses.toReceive, n: counts.receive, end: true },
  ];

  return (
    <>
      <Header title={copy.expenses.title} right={<ShareButton label={copy.expenses.shareLabel} title={copy.expenses.shareTitle} build={() => shareExpensesText(copy.expenses.shareTitle, shown, dir.nameOf, fmt)} />}>
        <div className="flex flex-wrap items-center justify-between gap-x-2 px-4">
          <HeaderTabs label={copy.expenses.title}>
            {tabs.map((t) => (
              <TabLink key={t.to} to={t.to} end={t.end} label={t.label} count={t.n === null ? undefined : `(${pad(t.n)})`} />
            ))}
          </HeaderTabs>
          <div className="flex shrink-0 items-center">
            <MenuButton label={copy.expenses.filter} options={[{ value: '', label: copy.expenses.allCategories }, ...categories.map((c) => ({ value: c, label: categoryLabel(c) }))]} value={category} onChange={setCategory} />
            <MenuButton
              label={copy.expenses.sort}
              icon="sort"
              options={[
                { value: 'newest', label: copy.expenses.sortNewest },
                { value: 'oldest', label: copy.expenses.sortOldest },
                { value: 'amount', label: copy.expenses.sortAmount },
              ]}
              value={sort}
              onChange={setSort}
            />
          </div>
        </div>
      </Header>
      <div className="flex flex-col gap-4 p-4 pb-24">
        <nav aria-label={copy.expenses.moreLinks} className="flex flex-wrap gap-2">
          {PILLS.map((p) => (
            <Link key={p.to} to={p.to} className="inline-flex min-h-11 items-center rounded-full border border-field-line bg-field px-4 text-sm font-semibold text-coral hover:bg-brand-soft">
              {p.label}
            </Link>
          ))}
        </nav>
        {list}
      </div>
      <Fab to="/expenses/new" label={copy.expenses.addExpense} disabledReason={access.writeBlockedReason ?? undefined} />
    </>
  );
}
