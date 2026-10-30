import { Link } from 'react-router-dom';
import type { Expense } from '@/api/expenses';
import { copy } from '@/copy';
import { formatDay } from '@/lib/format';
import { Avatar, Chip, Icon } from '@/ui';

/**
 * Expense card from the design: icon tile, title, "Total amount" in green, then "paid by" and the date.
 * A small line under the title says what it means for the signed-in member.
 */
export function ExpenseCard({
  expense,
  fmt,
  nameOf,
  avatarOf,
  myMemberId,
  showPay = false,
}: {
  expense: Expense;
  fmt: (minor: number) => string;
  nameOf: (memberId: string) => string;
  avatarOf: (memberId: string) => string | undefined;
  myMemberId: string;
  /** Adds the Pay button (opens the details, where it can be marked as paid). Used in To Pay. */
  showPay?: boolean;
}) {
  const payer = nameOf(expense.paidByMemberId);
  const mine = expense.shares.find((s) => s.memberId === myMemberId);
  const iPaid = expense.paidByMemberId === myMemberId;
  const deleted = expense.deletedAt !== null;

  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_3px_rgba(61,61,61,0.04)] ${deleted ? 'opacity-75' : ''}`}>
    <Link to={`/expenses/${expense.id}`} className="block">
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Icon name="receipt" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl leading-tight break-words text-ink-strong">{expense.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink2">
            {iPaid ? copy.expenses.youPaid : mine ? copy.expenses.yourShare(fmt(mine.shareAmountMinor)) : copy.expenses.notInvolved}
            {iPaid && mine ? ` · ${copy.expenses.yourShare(fmt(mine.shareAmountMinor))}` : ''}
            {deleted ? <Chip tone="danger">{copy.expenses.deleted}</Chip> : null}
          </p>
        </div>
        <div className="shrink-0 border-l border-line pl-3 text-left">
          <p className="text-xs text-ink2">{copy.expenseDetails.totalLine}</p>
          <p className={`text-2xl leading-tight font-bold ${deleted ? 'text-ink2 line-through' : 'text-success'}`}>{fmt(expense.amountMinor)}</p>
        </div>
      </div>
      <div className="mx-3 flex items-center border-t border-line text-xs">
        <span className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-ink2">
          <Avatar name={payer} color={avatarOf(expense.paidByMemberId)} size="sm" />
          <span className="truncate">
            {copy.expenses.paidBy('')}
            <b className="font-bold text-ink-strong">{iPaid ? copy.balances.you : payer}</b>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 border-l border-line py-2.5 pl-3 text-ink-strong">
          <Icon name="calendar" size={16} />
          {formatDay(expense.expenseDate)}
        </span>
      </div>
    </Link>
      {showPay && !deleted && mine && mine.shareAmountMinor > 0 && !iPaid ? (
        <div className="border-t border-peach-line bg-strip px-3 py-2.5">
          <Link to={`/expenses/${expense.id}`} aria-label={copy.expenses.payLabel(expense.title)} className="inline-flex min-h-11 w-full items-center justify-center rounded-[7px] bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-pressed">
            {copy.expenses.pay}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
