import { Link } from 'react-router-dom';
import type { Expense } from '@/api/expenses';
import { copy } from '@/copy';
import { formatDay } from '@/lib/format';
import { Avatar, Chip, Icon } from '@/ui';
import { categoryLabel } from './categories';

/**
 * Expense card in the mockup style: icon tile, title, total in green, then "paid by" and the date.
 * A strip underneath says what it means for the signed-in member.
 */
export function ExpenseCard({
  expense,
  fmt,
  nameOf,
  avatarOf,
  myMemberId,
}: {
  expense: Expense;
  fmt: (minor: number) => string;
  nameOf: (memberId: string) => string;
  avatarOf: (memberId: string) => string | undefined;
  myMemberId: string;
}) {
  const payer = nameOf(expense.paidByMemberId);
  const mine = expense.shares.find((s) => s.memberId === myMemberId);
  const iPaid = expense.paidByMemberId === myMemberId;
  const deleted = expense.deletedAt !== null;

  return (
    <Link to={`/expenses/${expense.id}`} className={`block overflow-hidden rounded-xl border border-line bg-surface ${deleted ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-3 p-3">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Icon name="receipt" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg text-ink-strong">{expense.title}</p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <Chip>{categoryLabel(expense.category)}</Chip>
            {deleted ? <Chip tone="danger">{copy.expenses.deleted}</Chip> : null}
          </div>
        </div>
        <div className="shrink-0 border-l border-line pl-3 text-right">
          <p className="text-xs text-ink2">{copy.expenseDetails.totalLine}</p>
          <p className={`text-xl font-bold ${deleted ? 'text-ink2 line-through' : 'text-success'}`}>{fmt(expense.amountMinor)}</p>
        </div>
      </div>
      <div className="flex items-center border-t border-line text-sm">
        <span className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-ink2">
          <Avatar name={payer} color={avatarOf(expense.paidByMemberId)} size="sm" />
          <span className="truncate">
            {copy.expenses.paidBy('')}
            <b className="font-semibold text-ink">{iPaid ? copy.balances.you : payer}</b>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 border-l border-line px-3 py-2 text-ink">
          <Icon name="calendar" size={16} />
          {formatDay(expense.expenseDate)}
        </span>
      </div>
      <p className="bg-strip px-3 py-1.5 text-sm text-ink">
        {iPaid ? copy.expenses.youPaid : mine ? copy.expenses.yourShare(fmt(mine.shareAmountMinor)) : copy.expenses.notInvolved}
        {iPaid && mine ? ` · ${copy.expenses.yourShare(fmt(mine.shareAmountMinor))}` : ''}
      </p>
    </Link>
  );
}
