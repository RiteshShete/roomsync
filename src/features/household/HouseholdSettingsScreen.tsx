import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setHouseholdArchived, updateHousehold, type DefaultSplit, type HouseholdDetails } from '@/api/households';
import { copy } from '@/copy';
import { errorMessage, toAppError } from '@/lib/errors';
import { SubPage } from '@/features/shell/SubPage';
import { Button, ConfirmDialog, ErrorState, Field, FormError, SelectField, SkeletonList, Toggle, useToast } from '@/ui';
import { currencyOptionsWith, SPLIT_OPTIONS } from './options';
import { useHousehold, useHouseholdAccess, useHouseholdHasMoney } from './useMembership';

function SettingsForm({ household, canEdit, readOnlyReason, currencyLocked }: { household: HouseholdDetails; canEdit: boolean; readOnlyReason: string | null; currencyLocked: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // Local edits survive a refetch, so a failed or conflicting save never wipes what the user typed.
  const [name, setName] = useState(household.name);
  const [currency, setCurrency] = useState(household.currencyCode);
  const [split, setSplit] = useState<DefaultSplit>(household.defaultSplit);
  const [reminders, setReminders] = useState(household.choreRemindersEnabled);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const patch = {
    ...(name.trim() !== household.name ? { name: name.trim() } : {}),
    ...(currency !== household.currencyCode ? { currencyCode: currency } : {}),
    ...(split !== household.defaultSplit ? { defaultSplit: split } : {}),
    ...(reminders !== household.choreRemindersEnabled ? { choreRemindersEnabled: reminders } : {}),
  };
  const dirty = Object.keys(patch).length > 0;

  const save = useMutation({
    mutationFn: () => updateHousehold(household.id, household.version, patch),
    onSuccess: async () => {
      setFormError(null);
      setConflict(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['household'] }), queryClient.invalidateQueries({ queryKey: ['membership'] })]);
      toast.show({ message: copy.settings.saved });
    },
    onError: (err) => {
      setConflict(toAppError(err).code === 'conflict');
      setFormError(errorMessage(err));
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending || !canEdit || !dirty) return;
    if (name.trim().length === 0) return void setNameError(copy.create.nameRequired);
    if (name.trim().length > 80) return void setNameError(copy.create.nameTooLong);
    setNameError(null);
    save.mutate();
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {!canEdit ? <p className="rounded-xl bg-sunken px-4 py-3 text-sm font-semibold text-ink">{readOnlyReason ?? copy.settings.readOnly}</p> : null}
      <Field label={copy.settings.name} value={name} maxLength={90} readOnly={!canEdit} aria-disabled={!canEdit || undefined} onChange={(e) => canEdit && setName(e.target.value)} error={nameError} />
      <SelectField
        label={copy.settings.currency}
        options={currencyOptionsWith(household.currencyCode)}
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        disabled={!canEdit || currencyLocked}
        disabledReason={currencyLocked ? copy.settings.currencyLocked : undefined}
      />
      <SelectField label={copy.settings.defaultSplit} options={SPLIT_OPTIONS} value={split} onChange={(e) => setSplit(e.target.value as DefaultSplit)} disabled={!canEdit} />
      <Toggle label={copy.settings.choreReminders} description={copy.create.choreRemindersHint} checked={reminders} onChange={setReminders} disabled={!canEdit} />
      <FormError message={formError} />
      {conflict ? (
        <Button variant="secondary" onClick={() => void queryClient.invalidateQueries({ queryKey: ['household'] })}>
          {copy.settings.refresh}
        </Button>
      ) : null}
      <Button
        type="submit"
        fullWidth
        loading={save.isPending}
        loadingLabel={copy.settings.saving}
        disabled={!canEdit || !dirty}
        disabledReason={!canEdit ? copy.settings.saveBlocked : copy.settings.nothingChanged}
      >
        {copy.settings.save}
      </Button>
    </form>
  );
}

/** Household settings plus archive/restore. Only owner/admin can edit; only the owner can archive or restore. */
export function HouseholdSettingsScreen() {
  const access = useHouseholdAccess();
  const household = useHousehold(access?.householdId);
  const hasMoney = useHouseholdHasMoney(access?.householdId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const archive = useMutation({
    mutationFn: (archived: boolean) => setHouseholdArchived(access!.householdId, archived),
    onSuccess: async (_v, archived) => {
      setConfirmArchive(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['household'] }), queryClient.invalidateQueries({ queryKey: ['membership'] })]);
      toast.show({ message: archived ? copy.settings.archived : copy.settings.restored });
    },
    onError: (err) => {
      setConfirmArchive(false);
      toast.show({ tone: 'error', message: errorMessage(err) });
    },
  });

  if (!access) return null;

  let form;
  if (household.isPending) form = <SkeletonList rows={3} />;
  else if (household.isError) form = <ErrorState message={errorMessage(household.error)} onRetry={() => void household.refetch()} />;
  else
    form = (
      <SettingsForm
        household={household.data}
        canEdit={access.isAdmin && !access.archived}
        readOnlyReason={access.archived ? copy.errors.householdArchived : access.isAdmin ? null : copy.settings.readOnly}
        currencyLocked={hasMoney.data === true}
      />
    );

  return (
    <SubPage title={copy.settings.title}>
      {form}
      <hr className="border-line" />
      <section className="flex flex-col gap-3" aria-labelledby="archive-title">
        <h2 id="archive-title" className="text-lg font-bold text-ink">
          {access.archived ? copy.settings.restoreTitle : copy.settings.archiveTitle}
        </h2>
        <p className="text-base text-ink2">{access.archived ? copy.settings.restoreBody : copy.settings.archiveBody}</p>
        {access.archived ? (
          <Button fullWidth loading={archive.isPending} disabled={!access.isOwner} disabledReason={copy.settings.ownerOnly} showReason onClick={() => archive.mutate(false)}>
            {copy.settings.restore}
          </Button>
        ) : (
          <Button variant="danger" fullWidth disabled={!access.isOwner} disabledReason={copy.settings.ownerOnly} showReason onClick={() => setConfirmArchive(true)}>
            {copy.settings.archive}
          </Button>
        )}
      </section>
      <ConfirmDialog
        open={confirmArchive}
        title={copy.settings.archiveConfirmTitle}
        confirmLabel={copy.settings.archiveConfirm}
        destructive
        loading={archive.isPending}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => archive.mutate(true)}
      >
        {copy.settings.archiveConfirmBody}
      </ConfirmDialog>
    </SubPage>
  );
}
