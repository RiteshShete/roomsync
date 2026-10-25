import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { recordSettlement } from '@/api/settlements';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { formatDay } from '@/lib/format';
import { SubPage } from '@/features/shell/SubPage';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { AmountInput, Avatar, Button, ErrorState, Field, FormError, SelectField, SkeletonList } from '@/ui';
import { todayIso } from '@/domain';
import { useDirectory } from '@/features/household/useDirectory';
import { useBalances, useInvalidateMoney, useMoney } from './hooks';

type Step = 'form' | 'review' | 'done';

/**
 * Journey D. Pick who paid whom (a suggestion pre-fills this), amount, date and note; review with
 * the statement that RoomSync moves no money; confirm; see a receipt-like record.
 */
export function RecordSettlementScreen() {
  const access = useHouseholdAccess();
  const { fmt, currency } = useMoney();
  const dir = useDirectory(access?.householdId);
  const balances = useBalances(access?.householdId);
  const invalidate = useInvalidateMoney();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [amount, setAmount] = useState<number | null>(() => {
    const n = Number(params.get('amount'));
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!access) return null;
  const back = '/expenses/balances';
  if (dir.isPending || balances.isPending) return <SubPage title={copy.settle.title} backTo={back}><SkeletonList rows={3} /></SubPage>;
  if (dir.isError || balances.isError)
    return (
      <SubPage title={copy.settle.title} backTo={back}>
        <ErrorState message={errorMessage(dir.error ?? balances.error)} onRetry={() => { void dir.refetch(); void balances.refetch(); }} />
      </SubPage>
    );

  const options: { value: string; label: string }[] = [
    { value: '', label: copy.settle.choose },
    ...dir.members.map((m) => ({
      value: m.memberId,
      label: `${m.memberId === access.memberId ? copy.settle.youLabel(m.displayName) : m.displayName}${m.status === 'left' ? ` (${copy.expenseForm.leftChip.toLowerCase()})` : ''}`,
    })),
  ];
  const net = (id: string) => balances.data.find((b) => b.memberId === id)?.netMinor ?? 0;
  const owedByPayer = Math.max(0, -net(from));

  let problem: string | null = null;
  if (!from || !to) problem = copy.settle.choose;
  else if (from === to) problem = copy.settle.sameMember;
  else if (amount === null) problem = copy.settle.amountRequired;
  else if (date > todayIso()) problem = copy.settle.futureDate;
  else if (!access.isAdmin && from !== access.memberId && to !== access.memberId) problem = copy.settle.memberOnly;
  const blocked = access.writeBlockedReason ?? problem;

  const field = (key: 'from' | 'to' | 'amount' | 'date') => {
    if (!touched || !problem) return null;
    const mapping: Record<string, string[]> = {
      from: [copy.settle.choose, copy.settle.sameMember, copy.settle.memberOnly],
      to: [],
      amount: [copy.settle.amountRequired],
      date: [copy.settle.futureDate],
    };
    return mapping[key]!.includes(problem) ? problem : null;
  };

  function onReview(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (blocked) return;
    setError(null);
    setStep('review');
  }

  async function onConfirm() {
    if (busy || amount === null) return;
    setBusy(true);
    setError(null);
    try {
      await recordSettlement({ householdId: access!.householdId, fromMemberId: from, toMemberId: to, amountMinor: amount, settlementDate: date, note: note.trim() || null });
      await invalidate();
      setStep('done');
    } catch (err) {
      setError(errorMessage(err)); // the details stay exactly as entered
    } finally {
      setBusy(false);
    }
  }

  const fromM = dir.member(from);
  const toM = dir.member(to);
  const summary = copy.settle.summary(dir.nameOf(from), dir.nameOf(to));

  if (step === 'done' && amount !== null)
    return (
      <SubPage title={copy.settle.title} backTo={back}>
        <section aria-labelledby="receipt" className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-6 text-center">
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success-text">✓</span>
          <h2 id="receipt" className="text-xl font-bold text-ink">{copy.settle.receiptTitle}</h2>
          <p className="text-base text-ink">{summary}</p>
          <p data-testid="receipt-amount" className="text-3xl font-bold text-success">{fmt(amount)}</p>
          <p className="text-sm text-ink2">{copy.settle.recordedOn(formatDay(date))}</p>
          {note.trim() ? <p className="text-sm text-ink2">{copy.settlements.note(note.trim())}</p> : null}
          <p className="mt-2 text-sm text-ink2">{copy.settle.receiptNote}</p>
        </section>
        <Button fullWidth onClick={() => navigate(back)}>{copy.settle.done}</Button>
        <Button variant="secondary" fullWidth onClick={() => { setStep('form'); setAmount(null); setNote(''); setTouched(false); }}>{copy.settle.another}</Button>
      </SubPage>
    );

  if (step === 'review' && amount !== null)
    return (
      <SubPage title={copy.settle.reviewTitle} backTo={back}>
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar name={fromM?.displayName ?? '?'} color={fromM?.avatarColor} size="md" />
            <span aria-hidden="true" className="text-ink2">→</span>
            <Avatar name={toM?.displayName ?? '?'} color={toM?.avatarColor} size="md" />
          </div>
          <p className="text-lg text-ink-strong">{summary}</p>
          <p className="text-3xl font-bold text-success">{fmt(amount)}</p>
          <p className="text-sm text-ink2">{copy.settle.recordedOn(formatDay(date))}</p>
          {note.trim() ? <p className="text-sm text-ink2">{copy.settlements.note(note.trim())}</p> : null}
        </section>
        <p role="note" className="rounded-xl bg-tint px-4 py-3 text-base font-semibold text-ink">{copy.settle.disclaimer}</p>
        {amount > owedByPayer ? (
          <p role="status" className="rounded-xl border border-warning bg-warning-soft px-4 py-3 text-sm font-semibold text-ink">
            {owedByPayer > 0 ? copy.settle.exceeds(dir.nameOf(from), fmt(owedByPayer)) : copy.settle.exceedsNothing(dir.nameOf(from))}
          </p>
        ) : null}
        <FormError message={error} />
        <Button fullWidth loading={busy} loadingLabel={copy.settle.recording} onClick={() => void onConfirm()}>{copy.settle.confirm}</Button>
        <Button variant="secondary" fullWidth onClick={() => setStep('form')}>{copy.settle.edit}</Button>
      </SubPage>
    );

  return (
    <SubPage title={copy.settle.title} backTo={back}>
      <form noValidate onSubmit={onReview} className="flex flex-col gap-4">
        <SelectField label={copy.settle.from} options={options} value={from} onChange={(e) => setFrom(e.target.value)} error={field('from')} />
        <SelectField label={copy.settle.to} options={options} value={to} onChange={(e) => setTo(e.target.value)} error={field('to')} />
        <AmountInput label={copy.settle.amount} currency={currency} valueMinor={amount} onChange={(m) => setAmount(m)} error={field('amount')} />
        <Field label={copy.settle.date} type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} error={field('date')} />
        <Field label={copy.settle.note} hint={copy.settle.noteHint} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-sm text-ink2">{copy.settle.disclaimer}</p>
        <FormError message={error} />
        <Button type="submit" fullWidth disabled={!!blocked} disabledReason={blocked ?? undefined}>{copy.settle.review}</Button>
        {blocked && touched ? <p className="text-center text-sm text-ink2">{blocked}</p> : null}
        <Link to={back} className="inline-flex min-h-11 items-center justify-center font-semibold text-coral underline-offset-4 hover:underline">Cancel</Link>
      </form>
    </SubPage>
  );
}
