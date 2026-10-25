import { useEffect, useState, type FormEvent } from 'react';
import { saveNotificationPrefs } from '@/api/activity';
import { copy } from '@/copy';
import { NOTIFICATION_CATEGORIES } from '@/domain';
import { errorMessage } from '@/lib/errors';
import { useInvalidateActivity, useNotificationPrefs } from '@/features/activity/hooks';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { SubPage } from '@/features/shell/SubPage';
import { Button, ErrorState, Field, FormError, SkeletonList, Toggle, useToast } from '@/ui';
import { checkPrefs, draftFromPrefs, type PrefsDraft } from './prefsModel';

/**
 * You → Notifications. Categories hide updates from your own activity centre and badge; quiet hours
 * only hide the unread number on the bell (there is no push, email or text to silence).
 */
export function NotificationPrefsScreen() {
  const access = useHouseholdAccess();
  const prefs = useNotificationPrefs(access?.memberId);
  const invalidate = useInvalidateActivity();
  const toast = useToast();
  const [draft, setDraft] = useState<PrefsDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (prefs.data && !draft) setDraft(draftFromPrefs(prefs.data));
  }, [prefs.data, draft]);

  if (!access) return null;
  if (!prefs.data || !draft) {
    return (
      <SubPage title={copy.notificationPrefs.title}>
        {prefs.isError ? <ErrorState message={errorMessage(prefs.error)} onRetry={() => void prefs.refetch()} /> : <SkeletonList rows={4} />}
      </SubPage>
    );
  }

  const check = checkPrefs(draft, prefs.data);
  const blocked = access.writeBlockedReason;
  const set = (patch: Partial<PrefsDraft>) => setDraft({ ...draft, ...patch });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !check.input) return;
    setBusy(true);
    setFormError(null);
    try {
      await saveNotificationPrefs(access!.memberId, check.input);
      await invalidate();
      toast.show({ message: copy.notificationPrefs.saved });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubPage title={copy.notificationPrefs.title}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
        <section aria-labelledby="prefs-categories" className="flex flex-col gap-1">
          <h2 id="prefs-categories" className="text-lg font-bold text-ink">
            {copy.notificationPrefs.categoriesTitle}
          </h2>
          <p className="text-sm text-ink2">{copy.notificationPrefs.categoriesBody}</p>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <Toggle key={c} label={copy.activity.categories[c]!} checked={draft.categories[c]} onChange={(on) => set({ categories: { ...draft.categories, [c]: on } })} />
          ))}
        </section>

        <section aria-labelledby="prefs-quiet" className="flex flex-col gap-3">
          <h2 id="prefs-quiet" className="text-lg font-bold text-ink">
            {copy.notificationPrefs.quietTitle}
          </h2>
          <Toggle label={copy.notificationPrefs.quietToggle} description={copy.notificationPrefs.quietBody} checked={draft.quietEnabled} onChange={(on) => set({ quietEnabled: on })} />
          {draft.quietEnabled ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={copy.notificationPrefs.from} type="time" value={draft.quietStart} onChange={(e) => set({ quietStart: e.target.value })} />
              <Field label={copy.notificationPrefs.to} type="time" value={draft.quietEnd} onChange={(e) => set({ quietEnd: e.target.value })} />
            </div>
          ) : null}
        </section>

        <FormError message={formError} />
        <Button
          type="submit"
          fullWidth
          loading={busy}
          loadingLabel={copy.notificationPrefs.saving}
          disabled={!check.ok || !!blocked}
          disabledReason={blocked ?? check.reason ?? undefined}
          showReason
        >
          {copy.notificationPrefs.save}
        </Button>
      </form>
    </SubPage>
  );
}
