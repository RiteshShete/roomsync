import { useState, type FormEvent } from 'react';
import { startMoveOut, type Member } from '@/api/households';
import { copy } from '@/copy';
import { addDays, checkMoveOutDate, latestMoveOutDate, todayIso } from '@/domain';
import { saveErrorMessage } from '@/lib/errors';
import { Button, Field, FormError, Sheet, TextArea } from '@/ui';

const NOTE_MAX = 1000;

/** An owner or admin starting a move-out for another member (never the owner). The member keeps access until the date. */
export function MemberMoveOutSheet({ member, blockedReason, onClose, onStarted }: { member: Member; blockedReason: string | null; onClose: () => void; onStarted: () => void }) {
  const today = todayIso();
  const [date, setDate] = useState(() => addDays(today, 7));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const problem = checkMoveOutDate(date, today);
  const reason = blockedReason ?? (problem ? copy.moveOut.dateReasons[problem]! : note.trim().length > NOTE_MAX ? copy.moveOut.noteReasonLong : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || reason) return;
    setBusy(true);
    setFormError(null);
    try {
      await startMoveOut({ memberId: member.memberId, effectiveDate: date, note: note.trim() === '' ? null : note.trim(), acknowledgedBalanceMinor: null });
      onStarted();
    } catch (err) {
      setFormError(saveErrorMessage(err)); // the sheet and its fields stay as they were
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={copy.moveOut.forOther.title(member.displayName)}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
        <p className="text-base text-ink2">{copy.moveOut.forOther.body(member.displayName)}</p>
        <Field label={copy.moveOut.date} hint={copy.moveOut.dateHint} type="date" min={today} max={latestMoveOutDate(today)} value={date} onChange={(e) => setDate(e.target.value)} />
        <TextArea label={copy.moveOut.note} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        <FormError message={formError} />
        <Button type="submit" variant="danger" fullWidth loading={busy} loadingLabel={copy.moveOut.confirming} disabled={!!reason} disabledReason={reason ?? undefined} showReason>
          {copy.moveOut.forOther.confirm}
        </Button>
      </form>
    </Sheet>
  );
}
