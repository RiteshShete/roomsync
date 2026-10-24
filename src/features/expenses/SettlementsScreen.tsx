import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { setSettlementStatus, type Settlement } from '@/api/settlements';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { formatDay } from '@/lib/format';
import { FormError } from '@/features/auth/AuthLayout';
import { useSession } from '@/features/auth/Session';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { Button, Chip, ConfirmDialog, EmptyState, ErrorState, Field, Fab, Sheet, SkeletonList, useToast } from '@/ui';
import { MoneyHeader } from './MoneyHeader';
import { useDirectory, useInvalidateMoney, useMoney, useSettlements } from './hooks';

/** Settlements grouped by status. Disputed ones get their own section; reversed ones are history. */
export function SettlementsScreen() {
  const access = useHouseholdAccess();
  const { fmt } = useMoney();
  const dir = useDirectory(access?.householdId);
  const list = useSettlements(access?.householdId);
  const session = useSession();
  const toast = useToast();
  const invalidate = useInvalidateMoney();
  const myUserId = session.status === 'signedIn' ? session.user.id : null;

  const [reversing, setReversing] = useState<Settlement | null>(null);
  const [disputing, setDisputing] = useState<Settlement | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: (v: { s: Settlement; status: 'recorded' | 'reversed' | 'disputed'; reason?: string }) => setSettlementStatus(v.s.id, v.status, v.reason, v.s.version),
    onSuccess: async (_d, v) => {
      await invalidate();
      setReversing(null);
      setDisputing(null);
      setReason('');
      toast.show({ message: v.status === 'reversed' ? copy.settlements.reversedToast : v.status === 'disputed' ? copy.settlements.disputedToast : copy.settlements.resolvedToast });
    },
    onError: (err, v) => {
      if (v.status === 'disputed') setDisputeError(errorMessage(err)); // keep the sheet and the typed reason
      else {
        setReversing(null);
        toast.show({ tone: 'error', message: errorMessage(err) });
      }
    },
  });

  if (!access) return null;
  const header = <MoneyHeader />;
  if (list.isPending || dir.isPending) return <>{header}<SkeletonList rows={3} /></>;
  if (list.isError) return <>{header}<ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} /></>;

  const blocked = access.writeBlockedReason ?? undefined;
  const by = (status: Settlement['status']) => list.data.filter((s) => s.status === status);
  const isParty = (s: Settlement) => access.memberId === s.fromMemberId || access.memberId === s.toMemberId;
  const canReverse = (s: Settlement) => access.isAdmin || s.recordedBy === myUserId;
  const canDispute = (s: Settlement) => access.isAdmin || (isParty(s) && s.recordedBy !== myUserId);
  const canResolve = (s: Settlement) => access.isAdmin || s.statusChangedBy === myUserId;

  const card = (s: Settlement) => (
    <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base text-ink-strong">{copy.settlements.line(dir.nameOf(s.fromMemberId), dir.nameOf(s.toMemberId))}</p>
          <p className="text-sm text-ink2">{formatDay(s.settlementDate)} · {copy.settlements.recordedBy(dir.nameOfUser(s.recordedBy))}</p>
        </div>
        <p className="shrink-0 text-xl font-bold text-success">{fmt(s.amountMinor)}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={s.status === 'recorded' ? 'success' : s.status === 'disputed' ? 'warning' : 'neutral'}>{copy.settlements.statuses[s.status]}</Chip>
      </div>
      {s.note ? <p className="text-sm text-ink2">{copy.settlements.note(s.note)}</p> : null}
      {s.statusReason ? <p className="text-sm text-ink2">{copy.settlements.reasonLine(s.statusReason)}</p> : null}
      {s.status !== 'reversed' ? (
        <div className="flex flex-wrap gap-2">
          {s.status === 'recorded' && canDispute(s) ? (
            <Button variant="secondary" disabled={!!blocked} disabledReason={blocked} onClick={() => { setDisputing(s); setReason(''); setReasonError(null); setDisputeError(null); }}>{copy.settlements.dispute}</Button>
          ) : null}
          {s.status === 'disputed' && canResolve(s) ? (
            <Button variant="secondary" disabled={!!blocked} disabledReason={blocked} loading={change.isPending && change.variables?.s.id === s.id && change.variables.status === 'recorded'} onClick={() => change.mutate({ s, status: 'recorded' })}>{copy.settlements.resolve}</Button>
          ) : null}
          {canReverse(s) ? (
            <Button variant="tertiary" disabled={!!blocked} disabledReason={blocked} onClick={() => setReversing(s)}>{copy.settlements.reverse}</Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );

  const section = (title: string, items: Settlement[], note?: string) =>
    items.length === 0 ? null : (
      <section key={title} aria-label={title} className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-ink">{title} ({items.length})</h2>
        {note ? <p className="text-sm text-ink2">{note}</p> : null}
        <ul className="flex flex-col gap-3">{items.map(card)}</ul>
      </section>
    );

  return (
    <>
      {header}
      <div className="flex flex-col gap-5 p-4 pb-24">
        {list.data.length === 0 ? (
          <EmptyState
            title={copy.settlements.emptyTitle}
            body={copy.settlements.emptyBody}
            action={<Link to="/expenses/settle" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-on-primary hover:bg-primary-pressed">{copy.expenses.recordSettlement}</Link>}
          />
        ) : (
          <>
            {section(copy.settlements.disputed, by('disputed'), copy.settlements.disputedNote)}
            {section(copy.settlements.recorded, by('recorded'))}
            {section(copy.settlements.reversed, by('reversed'))}
          </>
        )}
      </div>
      <Fab to="/expenses/settle" label={copy.expenses.recordSettlement} disabledReason={blocked} />

      <ConfirmDialog open={!!reversing} title={copy.settlements.reverseTitle} confirmLabel={copy.settlements.reverseConfirm} cancelLabel={copy.settlements.keep} destructive loading={change.isPending} onCancel={() => setReversing(null)} onConfirm={() => reversing && change.mutate({ s: reversing, status: 'reversed' })}>
        {copy.settlements.reverseBody}
      </ConfirmDialog>

      <Sheet open={!!disputing} onClose={() => setDisputing(null)} title={copy.settlements.disputeTitle}>
        <form
          noValidate
          className="flex flex-col gap-4 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (change.isPending || !disputing) return;
            if (reason.trim() === '') return void setReasonError(copy.settlements.reasonRequired);
            setReasonError(null);
            setDisputeError(null);
            change.mutate({ s: disputing, status: 'disputed', reason: reason.trim() });
          }}
        >
          <p className="text-base text-ink2">{copy.settlements.disputeBody}</p>
          <Field label={copy.settlements.reason} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} error={reasonError} />
          <FormError message={disputeError} />
          <Button type="submit" fullWidth loading={change.isPending} loadingLabel={copy.settlements.disputeConfirm}>{copy.settlements.disputeConfirm}</Button>
        </form>
      </Sheet>
    </>
  );
}
