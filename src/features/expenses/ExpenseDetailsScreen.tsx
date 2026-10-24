import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { deleteExpense, restoreExpense, type EditResult, type Expense, type HistoryEntry } from '@/api/expenses';
import { copy } from '@/copy';
import { formatPercentBp } from '@/domain';
import { errorMessage, toAppError } from '@/lib/errors';
import { formatDateTime, formatDay } from '@/lib/format';
import { useSession } from '@/features/auth/Session';
import { SubPage } from '@/features/shell/SubPage';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { Avatar, Button, Chip, ConfirmDialog, EmptyState, ErrorState, Icon, SkeletonList, useToast } from '@/ui';
import { categoryLabel } from './categories';
import { useDirectory, useExpense, useExpenseHistory, useInvalidateMoney, useMoney } from './hooks';

function describeChange(h: HistoryEntry, fmt: (m: number) => string): string[] {
  if (h.action !== 'edited' || !h.before || !h.after) return [];
  const lines: string[] = [];
  if (h.before.title !== h.after.title) lines.push(copy.expenseDetails.changedTitle(String(h.before.title), String(h.after.title)));
  if (h.before.amount_minor !== h.after.amount_minor) lines.push(copy.expenseDetails.changedAmount(fmt(Number(h.before.amount_minor)), fmt(Number(h.after.amount_minor))));
  else if (JSON.stringify(h.before.shares) !== JSON.stringify(h.after.shares) || h.before.split_method !== h.after.split_method) lines.push(copy.expenseDetails.changedSplit);
  return lines;
}

function roundingNote(e: Expense, nameOf: (id: string) => string, fmt: (m: number) => string): string | null {
  if (e.splitMethod !== 'equal' || e.shares.length < 2) return null;
  const min = Math.min(...e.shares.map((s) => s.shareAmountMinor));
  const extra = e.shares.filter((s) => s.shareAmountMinor > min);
  return extra.length > 0 ? copy.expenseForm.rounding(fmt(1), extra.map((s) => nameOf(s.memberId)).join(', ')) : null;
}

/** Everything about one expense: the exact calculation, who paid, history, and permission-aware actions. */
export function ExpenseDetailsScreen() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateMoney();
  const access = useHouseholdAccess();
  const { fmt } = useMoney();
  const session = useSession();
  const dir = useDirectory(access?.householdId);
  const expense = useExpense(id);
  const history = useExpenseHistory(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [impactDismissed, setImpactDismissed] = useState(false);
  const impact = (location.state as { edit?: EditResult } | null)?.edit;

  const restore = useMutation({
    mutationFn: (expenseId: string) => restoreExpense(expenseId),
    onSuccess: async () => {
      await invalidate();
      toast.show({ message: copy.expenseDetails.restored });
    },
    onError: (err) => toast.show({ tone: 'error', message: errorMessage(err) }),
  });

  const del = useMutation({
    mutationFn: (e: Expense) => deleteExpense(e.id, e.version),
    onSuccess: async (_v, e) => {
      setConfirmDelete(false);
      await invalidate();
      toast.show({ message: copy.expenseDetails.deletedToast, action: { label: copy.expenseDetails.undo, onClick: () => restore.mutate(e.id) } });
      navigate('/expenses', { replace: true });
    },
    onError: (err) => {
      setConfirmDelete(false);
      toast.show({ tone: 'error', message: errorMessage(err) });
    },
  });

  if (!access) return null;
  const page = (children: React.ReactNode) => (
    <SubPage title={copy.expenseDetails.title} backTo="/expenses">
      {children}
    </SubPage>
  );
  if (expense.isPending || dir.isPending) return page(<SkeletonList rows={4} />);
  if (expense.isError) {
    const gone = toAppError(expense.error).code !== 'network';
    return page(gone ? <EmptyState title={copy.expenseDetails.notFoundTitle} body={copy.expenseDetails.notFoundBody} /> : <ErrorState message={errorMessage(expense.error)} onRetry={() => void expense.refetch()} />);
  }

  const e = expense.data;
  const deleted = e.deletedAt !== null;
  const myUserId = session.status === 'signedIn' ? session.user.id : null;
  const canChange = access.isAdmin || e.createdBy === myUserId;
  const note = roundingNote(e, dir.nameOf, fmt);
  const payer = dir.member(e.paidByMemberId);

  return page(
    <>
      {impact && !impactDismissed ? (
        <section role="status" aria-labelledby="impact-title" className="rounded-xl border border-tint-line bg-tint p-4">
          <h2 id="impact-title" className="text-base font-bold text-ink">{copy.expenseDetails.impactTitle}</h2>
          {impact.impact.length > 0 ? (
            <ul className="mt-1 text-sm text-ink">
              {impact.impact.map((i) => (
                <li key={i.memberId}>{copy.expenseDetails.impactLine(dir.nameOf(i.memberId), fmt(i.beforeMinor), fmt(i.afterMinor))}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-sm text-ink2">{impact.settlementsExist ? copy.expenseDetails.impactSettlements : copy.expenseDetails.impactNoSettlements}</p>
          <Button variant="tertiary" onClick={() => setImpactDismissed(true)}>{copy.expenseDetails.dismiss}</Button>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-3 p-4">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
            <Icon name="receipt" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl text-ink-strong">{e.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Chip>{categoryLabel(e.category)}</Chip>
              {deleted ? <Chip tone="danger">{copy.expenses.deleted}</Chip> : null}
            </div>
          </div>
          <p className={`text-2xl font-bold ${deleted ? 'text-ink2 line-through' : 'text-success'}`}>{fmt(e.amountMinor)}</p>
        </div>
        {deleted ? (
          <p className="border-t border-line bg-danger-soft px-4 py-2 text-sm text-ink">{copy.expenseDetails.deletedBanner(dir.nameOfUser(e.deletedBy), formatDateTime(e.deletedAt!))}</p>
        ) : null}
        <dl className="divide-y divide-line border-t border-line text-base">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-ink2">{copy.expenseDetails.paidBy}</dt>
            <dd className="flex items-center gap-2 font-semibold text-ink">
              <Avatar name={payer?.displayName ?? '?'} color={payer?.avatarColor} size="sm" />
              {e.paidByMemberId === access.memberId ? `${payer?.displayName} (${copy.members.you})` : dir.nameOf(e.paidByMemberId)}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-ink2">{copy.expenseDetails.date}</dt>
            <dd className="font-semibold text-ink">{formatDay(e.expenseDate)}</dd>
          </div>
          {e.notes ? (
            <div className="px-4 py-3">
              <dt className="text-ink2">{copy.expenseDetails.notes}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">{e.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="split-title" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="split-title" className="text-base font-bold text-ink">{copy.expenseDetails.split}</h2>
        <p className="text-sm text-ink2">{copy.expenseDetails.method(copy.expenseForm.methods[e.splitMethod]!)}</p>
        <table className="mt-2 w-full text-base">
          <thead className="sr-only">
            <tr><th>Person</th><th>{copy.expenseDetails.share}</th></tr>
          </thead>
          <tbody>
            {e.shares.map((s) => (
              <tr key={s.memberId} className="border-t border-line first:border-t-0">
                <td className="py-2 text-ink">{dir.nameOf(s.memberId)}{s.memberId === access.memberId ? ` (${copy.members.you})` : ''}</td>
                <td className="py-2 text-right font-bold text-ink">
                  {fmt(s.shareAmountMinor)}
                  {s.percentBp !== null ? <span className="font-normal text-ink2"> · {formatPercentBp(s.percentBp)}%</span> : null}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <th scope="row" className="py-2 text-left font-semibold text-ink">{copy.expenseDetails.totalLine}</th>
              <td className="py-2 text-right font-bold text-ink">{fmt(e.shares.reduce((t, s) => t + s.shareAmountMinor, 0))}</td>
            </tr>
          </tbody>
        </table>
        {note ? <p className="mt-1 text-sm text-ink2">{note}</p> : null}
      </section>

      <p className="text-sm text-ink2">
        {copy.expenseDetails.addedBy(dir.nameOfUser(e.createdBy), formatDateTime(e.createdAt))}
        {e.version > 1 ? <><br />{copy.expenseDetails.updatedBy(dir.nameOfUser(e.updatedBy), formatDateTime(e.updatedAt))}</> : null}
      </p>

      {deleted ? (
        <Button fullWidth loading={restore.isPending} disabled={!canChange || !!access.writeBlockedReason} disabledReason={access.writeBlockedReason ?? copy.expenseDetails.noPermission} showReason={!canChange || !!access.writeBlockedReason} onClick={() => restore.mutate(e.id)}>
          {copy.expenseDetails.restore}
        </Button>
      ) : (
        <div className="flex gap-3">
          {canChange && !access.writeBlockedReason ? (
            <Link to={`/expenses/${e.id}/edit`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-5 text-base font-semibold text-coral hover:bg-brand-soft">
              {copy.expenseDetails.edit}
            </Link>
          ) : (
            <Button variant="secondary" className="flex-1" disabled disabledReason={access.writeBlockedReason ?? copy.expenseDetails.noPermission}>
              {copy.expenseDetails.edit}
            </Button>
          )}
          <Button variant="danger" className="flex-1" disabled={!canChange || !!access.writeBlockedReason} disabledReason={access.writeBlockedReason ?? copy.expenseDetails.noPermission} onClick={() => setConfirmDelete(true)}>
            {copy.expenseDetails.delete}
          </Button>
        </div>
      )}
      {!canChange ? <p className="text-sm text-ink2">{copy.expenseDetails.noPermission}</p> : null}

      <section aria-labelledby="history-title" className="flex flex-col gap-2">
        <h2 id="history-title" className="text-base font-bold text-ink">{copy.expenseDetails.history}</h2>
        {history.isPending ? <SkeletonList rows={2} /> : history.isError ? <ErrorState message={errorMessage(history.error)} onRetry={() => void history.refetch()} /> : (
          <ol aria-labelledby="history-title" className="flex flex-col gap-2">
            {history.data.map((h) => (
              <li key={h.id} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                <p className="text-ink">{copy.expenseDetails.historyBy(copy.expenseDetails.actions[h.action] ?? h.action, dir.nameOf(h.actorMemberId), formatDateTime(h.createdAt))}</p>
                {describeChange(h, fmt).map((line) => (
                  <p key={line} className="text-ink2">{line}</p>
                ))}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog open={confirmDelete} title={copy.expenseDetails.deleteTitle} confirmLabel={copy.expenseDetails.deleteConfirm} destructive loading={del.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={() => del.mutate(e)}>
        {copy.expenseDetails.deleteBody}
      </ConfirmDialog>
    </>,
  );
}
