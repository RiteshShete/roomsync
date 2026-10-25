import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { addMoveOutNote, cancelMoveOut, startMoveOut } from '@/api/households';
import { copy } from '@/copy';
import { addDays, latestMoveOutDate, moveOutTiming, todayIso } from '@/domain';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatDay } from '@/lib/format';
import { useBalances, useMoney } from '@/features/expenses/hooks';
import { useHouseholdAccess, useMembers, useMembership, type HouseholdAccess } from '@/features/household/useMembership';
import { SubPage } from '@/features/shell/SubPage';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, FormError, SkeletonList, TextArea, useToast } from '@/ui';
import { useInvalidateMembership, useMoveOut, useMoveOutNotes } from './hooks';
import { checkMoveOut, checkNote, NOTE_MAX } from './moveOutModel';
import { OutstandingSummary } from './OutstandingSummary';

const timingText = (effective: string, today: string): string => {
  const t = moveOutTiming(effective, today);
  return t.kind === 'inDays' ? copy.moveOut.timing.inDays(t.days) : copy.moveOut.timing[t.kind];
};

/** Step 1 explains the consequences; step 2 shows what is outstanding and asks for an explicit confirmation. */
function Wizard({ access }: { access: HouseholdAccess }) {
  const toast = useToast();
  const refresh = useInvalidateMembership();
  const balances = useBalances(access.householdId);
  const today = todayIso();
  const [step, setStep] = useState<'intro' | 'review'>('intro');
  const [date, setDate] = useState(() => addDays(today, 7));
  const [note, setNote] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const check = checkMoveOut({ date, note, understood }, today);
  const blocked = access.writeBlockedReason ?? check.reason;
  const net = balances.data?.find((b) => b.memberId === access.memberId)?.netMinor ?? null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || blocked || !check.input) return;
    setBusy(true);
    setFormError(null);
    try {
      await startMoveOut({ memberId: access.memberId, effectiveDate: check.input.effectiveDate, note: check.input.note, acknowledgedBalanceMinor: net });
      toast.show({ message: check.input.effectiveDate === today ? copy.moveOut.startedToday : copy.moveOut.started });
      await refresh();
    } catch (err) {
      setFormError(errorMessage(err)); // the date, note and tick stay as they were
    } finally {
      setBusy(false);
    }
  }

  if (step === 'intro') {
    return (
      <>
        <section aria-labelledby="mo-intro" className="flex flex-col gap-3 rounded-xl border border-tint-line bg-tint p-4">
          <h2 id="mo-intro" className="text-lg font-bold text-ink">
            {copy.moveOut.introTitle}
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-base text-ink">
            {copy.moveOut.consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <Button fullWidth onClick={() => setStep('review')}>
          {copy.moveOut.next}
        </Button>
      </>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink">{copy.moveOut.reviewTitle}</h2>
      <OutstandingSummary access={access} />

      <section aria-labelledby="mo-date" className="flex flex-col gap-3">
        <h2 id="mo-date" className="text-lg font-bold text-ink">
          {copy.moveOut.dateTitle}
        </h2>
        <Field label={copy.moveOut.date} hint={copy.moveOut.dateHint} type="date" min={today} max={latestMoveOutDate(today)} value={date} onChange={(e) => setDate(e.target.value)} />
      </section>

      <section aria-labelledby="mo-note" className="flex flex-col gap-3">
        <h2 id="mo-note" className="text-lg font-bold text-ink">
          {copy.moveOut.noteTitle}
        </h2>
        <TextArea label={copy.moveOut.note} hint={copy.moveOut.noteHint} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
      </section>

      <section aria-labelledby="mo-confirm" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h2 id="mo-confirm" className="text-lg font-bold text-ink">
          {copy.moveOut.confirmTitle}
        </h2>
        <label className="flex min-h-11 items-start gap-3 text-base text-ink">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 cursor-pointer accent-[var(--primary)]" />
          <span>{copy.moveOut.understand}</span>
        </label>
        <FormError message={formError} />
        <Button type="submit" variant="danger" fullWidth loading={busy} loadingLabel={copy.moveOut.confirming} disabled={!!blocked} disabledReason={blocked ?? undefined} showReason>
          {copy.moveOut.confirmButton}
        </Button>
        <Button variant="tertiary" fullWidth onClick={() => setStep('intro')}>
          {copy.moveOut.back}
        </Button>
      </section>
    </form>
  );
}

/** While `leaving`: when it takes effect, what was recorded, what is unresolved, notes, and cancel. */
function LeavingStatus({ access, effectiveDate }: { access: HouseholdAccess; effectiveDate: string | null }) {
  const toast = useToast();
  const refresh = useInvalidateMembership();
  const { fmt } = useMoney();
  const moveOut = useMoveOut(access.memberId, true);
  const notes = useMoveOutNotes(access.memberId, true);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const today = todayIso();

  const check = checkNote(text);

  async function onAddNote(e: FormEvent) {
    e.preventDefault();
    if (adding || !check.note) return;
    setAdding(true);
    setNoteError(null);
    try {
      await addMoveOutNote(access.memberId, check.note);
      setText('');
      await notes.refetch();
      toast.show({ message: copy.moveOut.noteAdded });
    } catch (err) {
      setNoteError(errorMessage(err)); // the text stays
    } finally {
      setAdding(false);
    }
  }

  async function onCancel() {
    setCancelling(true);
    try {
      await cancelMoveOut(access.memberId);
      setConfirming(false);
      toast.show({ message: copy.moveOut.cancelled });
      await refresh();
    } catch (err) {
      setConfirming(false);
      toast.show({ tone: 'error', message: errorMessage(err) });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <section aria-labelledby="mo-status" className="flex flex-col gap-2 rounded-xl border border-tint-line bg-tint p-4">
        <h2 id="mo-status" className="text-lg font-bold text-ink">
          {copy.moveOut.statusTitle}
        </h2>
        {effectiveDate ? (
          <p className="text-base font-bold text-ink-strong">
            {copy.moveOut.statusOn(formatDay(effectiveDate))} · {timingText(effectiveDate, today)}
          </p>
        ) : null}
        <p className="text-base text-ink">{copy.moveOut.stillAccess}</p>
      </section>

      {moveOut.data && (moveOut.data.acknowledgedBalanceMinor !== null || moveOut.data.note) ? (
        <section aria-labelledby="mo-recorded" className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
          <h2 id="mo-recorded" className="text-base font-bold text-ink">
            {copy.moveOut.recordedTitle}
          </h2>
          {moveOut.data.acknowledgedBalanceMinor !== null ? <p className="text-base text-ink">{copy.moveOut.recordedBalance(fmt(moveOut.data.acknowledgedBalanceMinor))}</p> : null}
          {moveOut.data.note ? (
            <p className="text-base whitespace-pre-wrap text-ink">
              <span className="font-bold">{copy.moveOut.recordedNote}: </span>
              {moveOut.data.note}
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="mo-unresolved" className="flex flex-col gap-3">
        <div>
          <h2 id="mo-unresolved" className="text-lg font-bold text-ink">
            {copy.moveOut.unresolvedTitle}
          </h2>
          <p className="text-sm text-ink2">{copy.moveOut.unresolvedBody}</p>
        </div>
        <OutstandingSummary access={access} />
      </section>

      <section aria-labelledby="mo-notes" className="flex flex-col gap-3">
        <div>
          <h2 id="mo-notes" className="text-lg font-bold text-ink">
            {copy.moveOut.notesTitle}
          </h2>
          <p className="text-sm text-ink2">{copy.moveOut.notesBody}</p>
        </div>
        {notes.isPending ? (
          <SkeletonList rows={1} />
        ) : notes.isError ? (
          <ErrorState message={errorMessage(notes.error)} onRetry={() => void notes.refetch()} />
        ) : notes.data.length === 0 ? (
          <p className="text-base text-ink2">{copy.moveOut.notesEmpty}</p>
        ) : (
          <ul aria-label={copy.moveOut.notesTitle} className="flex flex-col gap-2">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-base whitespace-pre-wrap text-ink">{n.note}</p>
                <p className="mt-1 text-xs text-ink2">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
        <form noValidate onSubmit={onAddNote} className="flex flex-col gap-3">
          <TextArea label={copy.moveOut.noteLabel} maxLength={NOTE_MAX} value={text} onChange={(e) => setText(e.target.value)} />
          <FormError message={noteError} />
          <Button type="submit" variant="secondary" loading={adding} loadingLabel={copy.moveOut.noteSaving} disabled={!check.ok} disabledReason={check.reason ?? undefined} showReason>
            {copy.moveOut.noteSave}
          </Button>
        </form>
      </section>

      <Button variant="danger" fullWidth disabled={!!access.writeBlockedReason} disabledReason={access.writeBlockedReason ?? undefined} showReason onClick={() => setConfirming(true)}>
        {copy.moveOut.cancel}
      </Button>
      <ConfirmDialog open={confirming} title={copy.moveOut.cancelTitle} confirmLabel={copy.moveOut.cancelConfirm} cancelLabel={copy.moveOut.cancelKeep} loading={cancelling} onConfirm={() => void onCancel()} onCancel={() => setConfirming(false)}>
        {copy.moveOut.cancelBody}
      </ConfirmDialog>
    </>
  );
}

/** You → Household settings → Leave household. The owner is told what to do first; everyone else gets the flow. */
export function MoveOutScreen() {
  const access = useHouseholdAccess();
  const membership = useMembership();
  const members = useMembers(access?.householdId);

  if (!access) return null;
  let body;
  if (membership.isPending || members.isPending) body = <SkeletonList rows={4} />;
  else if (membership.isError || members.isError) {
    body = <ErrorState message={errorMessage(membership.error ?? members.error)} onRetry={() => void Promise.all([membership.refetch(), members.refetch()])} />;
  } else if (access.isOwner) {
    const alone = members.data.length <= 1;
    body = (
      <EmptyState
        title={alone ? copy.moveOut.soleTitle : copy.moveOut.ownerTitle}
        body={alone ? copy.moveOut.soleBody : copy.moveOut.ownerBody}
        action={
          <Link to={alone ? '/you/household' : '/you/members'} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-primary px-5 font-semibold text-on-primary hover:bg-primary-pressed">
            {alone ? copy.moveOut.soleGo : copy.moveOut.ownerGo}
          </Link>
        }
      />
    );
  } else if (membership.data?.status === 'leaving') {
    body = <LeavingStatus access={access} effectiveDate={membership.data.moveOutEffectiveDate} />;
  } else {
    body = <Wizard access={access} />;
  }

  return (
    <SubPage title={copy.moveOut.title} backTo="/you/household">
      {body}
    </SubPage>
  );
}
