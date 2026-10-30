import { useState } from 'react';
import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { explainBalance, suggestTransfers, type BalanceLine } from '@/domain';
import { errorMessage } from '@/lib/errors';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { Avatar, Button, Chip, EmptyState, ErrorState, SkeletonList } from '@/ui';
import { MoneyHeader } from './MoneyHeader';
import { useDirectory } from '@/features/household/useDirectory';
import { useBalanceInputs, useBalances, useMoney, useSettlements } from './hooks';

const signed = (n: number, fmt: (m: number) => string) => `${n < 0 ? '−' : '+'}${fmt(Math.abs(n))}`;

/**
 * Everyone's net balance, suggested payments (labelled "Suggestion", never executed), and a
 * "Why do I owe this?" breakdown whose lines add up exactly to the displayed balance.
 */
export function BalancesScreen() {
  const access = useHouseholdAccess();
  const { fmt } = useMoney();
  const dir = useDirectory(access?.householdId);
  const balances = useBalances(access?.householdId);
  const inputs = useBalanceInputs(access?.householdId, access?.memberId);
  const settlements = useSettlements(access?.householdId);
  const [open, setOpen] = useState(false);

  if (!access) return null;
  const header = <MoneyHeader />;

  if (balances.isPending || dir.isPending) return <>{header}<SkeletonList rows={4} /></>;
  if (balances.isError) return <>{header}<ErrorState message={errorMessage(balances.error)} onRetry={() => void balances.refetch()} /></>;
  if (dir.isError) return <>{header}<ErrorState message={errorMessage(dir.error)} onRetry={() => void dir.refetch()} /></>;

  const rows = balances.data
    .map((b) => ({ ...b, member: dir.member(b.memberId) }))
    .filter((r) => r.member && (r.member.status !== 'left' || r.netMinor !== 0))
    .sort((a, b) => b.netMinor - a.netMinor || a.memberId.localeCompare(b.memberId));
  const net = Object.fromEntries(balances.data.map((b) => [b.memberId, b.netMinor]));
  const suggestions = suggestTransfers(net);
  const mine = net[access.memberId] ?? 0;
  const disputed = settlements.data?.filter((s) => s.status === 'disputed').length ?? 0;

  const lines: BalanceLine[] = inputs.data ? explainBalance(access.memberId, inputs.data.expenses, inputs.data.settlements) : [];
  const total = lines.reduce((t, l) => t + l.amountMinor, 0);
  const lineText = (l: BalanceLine): string => {
    if (l.kind === 'paid') return copy.balances.paidFor(l.label ?? 'an expense');
    if (l.kind === 'share') return copy.balances.shareOf(l.label ?? 'an expense');
    const s = inputs.data?.settlements.find((x) => x.id === l.refId);
    return l.kind === 'settlement_out' ? copy.balances.youPaidSettlement(dir.nameOf(s?.to)) : copy.balances.paidYouSettlement(dir.nameOf(s?.from));
  };
  const why = mine < 0 ? copy.balances.whyOwe : mine > 0 ? copy.balances.whyOwed : copy.balances.whyZero;
  const canRecord = (from: string, to: string) => access.isAdmin || from === access.memberId || to === access.memberId;

  return (
    <>
      {header}
      <div className="flex flex-col gap-5 p-4">
        <section aria-labelledby="everyone" className="flex flex-col gap-3">
          <h2 id="everyone" className="text-lg font-bold text-ink">{copy.balances.everyone}</h2>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.memberId} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                <Avatar name={r.member!.displayName} color={r.member!.avatarColor} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-ink-strong">
                    {r.member!.displayName}
                    {r.memberId === access.memberId ? ` (${copy.members.you})` : ''}
                  </p>
                  {r.member!.status === 'left' ? <Chip tone="warning">{copy.expenseForm.leftChip}</Chip> : null}
                </div>
                <p className={`text-right text-base font-bold ${r.netMinor > 0 ? 'text-success-text' : r.netMinor < 0 ? 'text-danger' : 'text-ink2'}`}>
                  {r.netMinor === 0 ? copy.balances.settled : r.netMinor > 0 ? copy.balances.isOwed(fmt(r.netMinor)) : copy.balances.owes(fmt(-r.netMinor))}
                </p>
              </li>
            ))}
          </ul>
          {disputed > 0 ? (
            <p role="status" className="text-sm text-ink2">
              {copy.balances.disputed(disputed)}{' '}
              <Link to="/expenses/settlements" className="font-semibold text-coral underline-offset-4 hover:underline">{copy.balances.seeSettlements}</Link>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="suggestions" className="flex flex-col gap-3">
          <h2 id="suggestions" className="text-lg font-bold text-ink">{copy.balances.suggestionsTitle}</h2>
          <p className="text-sm text-ink2">{copy.balances.suggestionNote}</p>
          {suggestions.length === 0 ? (
            <EmptyState title={copy.balances.noSuggestions} />
          ) : (
            <ul className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <li key={`${s.from}-${s.to}`} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base text-ink">{copy.balances.suggestionLine(dir.nameOf(s.from), dir.nameOf(s.to), fmt(s.amountMinor))}</p>
                    <Chip tone="info">{copy.balances.suggestionTag}</Chip>
                  </div>
                  {canRecord(s.from, s.to) && !access.writeBlockedReason ? (
                    <Link
                      to={`/expenses/settle?from=${s.from}&to=${s.to}&amount=${s.amountMinor}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-base font-semibold text-coral hover:bg-brand-soft"
                    >
                      {copy.balances.recordThis}
                    </Link>
                  ) : (
                    <Button variant="secondary" disabled disabledReason={access.writeBlockedReason ?? copy.settle.memberOnly} showReason>
                      {copy.balances.recordThis}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="why" className="rounded-xl border border-line bg-surface">
          <h2 id="why">
            <button type="button" aria-expanded={open} aria-controls="why-body" onClick={() => setOpen((o) => !o)} className="flex min-h-12 w-full cursor-pointer items-center justify-between px-4 text-left text-base font-bold text-coral">
              {why}
              <span aria-hidden="true">{open ? '−' : '+'}</span>
            </button>
          </h2>
          <div id="why-body" hidden={!open} className="border-t border-line px-4 py-3">
            {inputs.isPending ? (
              <SkeletonList rows={2} />
            ) : inputs.isError ? (
              <ErrorState message={errorMessage(inputs.error)} onRetry={() => void inputs.refetch()} />
            ) : lines.length === 0 ? (
              <p className="text-sm text-ink2">{copy.balances.settled}</p>
            ) : (
              <>
                <ul className="flex flex-col gap-1.5">
                  {lines.map((l, i) => (
                    <li key={`${l.refId}-${l.kind}-${i}`} className="flex justify-between gap-3 text-base">
                      <span className="text-ink">{lineText(l)}</span>
                      <span className={`shrink-0 font-bold ${l.amountMinor < 0 ? 'text-danger' : 'text-success-text'}`}>{signed(l.amountMinor, fmt)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
                  <span>{copy.balances.yourBalance}</span>
                  <span data-testid="why-total">{total === 0 ? fmt(0) : signed(total, fmt)}</span>
                </p>
                {total !== mine || inputs.data?.truncated ? <p role="status" className="mt-2 text-sm text-danger">{copy.balances.mismatch}</p> : null}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
