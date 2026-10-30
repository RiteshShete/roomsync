import { useState, type FormEvent } from 'react';
import { createAnnouncement, updateAnnouncement, type Announcement } from '@/api/announcements';
import { copy } from '@/copy';
import { toAppError, saveErrorMessage } from '@/lib/errors';
import { Button, Field, FormError, Sheet, TextArea, useToast } from '@/ui';
import { useInvalidateAnnouncements } from './hooks';
import { BODY_MAX, checkAnnouncement, TITLE_MAX } from './formModel';

/** Compose (no `item`) or edit sheet. A failed save keeps the sheet open with everything as typed. */
export function AnnouncementSheet({
  item,
  householdId,
  userId,
  blockedReason,
  onClose,
  onConflict,
}: {
  item?: Announcement;
  householdId: string;
  userId: string;
  blockedReason: string | null;
  onClose: () => void;
  onConflict: () => void;
}) {
  // The parent remounts this per item (keyed), so local state always starts from `item`.
  const toast = useToast();
  const invalidate = useInvalidateAnnouncements();
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const check = checkAnnouncement({ title, body }, item && { title: item.title, body: item.body });
  const reason = blockedReason ?? check.reason;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || reason || !check.input) return;
    setBusy(true);
    setFormError(null);
    try {
      if (item) await updateAnnouncement(item.id, item.version, check.input);
      else await createAnnouncement(householdId, userId, check.input);
      await invalidate();
      toast.show({ message: item ? copy.announcements.updated : copy.announcements.posted });
      onClose();
    } catch (err) {
      if (toAppError(err).code === 'conflict') {
        await invalidate();
        onConflict();
        onClose();
      } else setFormError(saveErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={item ? copy.announcements.editTitle : copy.announcements.addTitle}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
        <Field label={copy.announcements.heading} placeholder={copy.announcements.headingPlaceholder} autoComplete="off" maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextArea label={copy.announcements.message} maxLength={BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
        <FormError message={formError} />
        <Button type="submit" fullWidth loading={busy} loadingLabel={copy.announcements.saving} disabled={!!reason} disabledReason={reason ?? undefined} showReason>
          {item ? copy.announcements.saveEdit : copy.announcements.save}
        </Button>
      </form>
    </Sheet>
  );
}
