import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createHousehold, type DefaultSplit } from '@/api/households';
import { createInvite, type CreatedInvite } from '@/api/invites';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { AuthLayout, FormError } from '@/features/auth/AuthLayout';
import { Button, Field, SelectField, Toggle, useToast } from '@/ui';
import { InviteCodePanel } from './InviteCodePanel';
import { CURRENCY_OPTIONS, SPLIT_OPTIONS } from './options';
import { useMembership } from './useMembership';

/**
 * Journey A. Step 1: name (+ optional settings, skippable). Step 2: invite roommates (skippable).
 * Nobody is assumed to join: the code is shown as pending and the user can continue straight away.
 */
export function CreateHouseholdScreen() {
  const membership = useMembership();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [split, setSplit] = useState<DefaultSplit>('equal');
  const [reminders, setReminders] = useState(true);
  const [more, setMore] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Someone who already has a household has no business here (but not while finishing step 2).
  if (!householdId && membership.data) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) return void setNameError(copy.create.nameRequired);
    if (trimmed.length > 80) return void setNameError(copy.create.nameTooLong);
    setNameError(null);
    setFormError(null);
    setBusy(true);
    try {
      const id = await createHousehold({ name: trimmed, currencyCode: currency, defaultSplit: split, choreReminders: reminders });
      setHouseholdId(id);
      toast.show({ message: copy.create.createdToast });
    } catch (err) {
      setFormError(errorMessage(err)); // everything typed stays as is
    } finally {
      setBusy(false);
    }
  }

  async function onCreateInvite() {
    if (!householdId || inviteBusy) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      setInvite(await createInvite(householdId));
    } catch (err) {
      setInviteError(errorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  }

  async function finish() {
    await queryClient.invalidateQueries({ queryKey: ['membership'] });
    navigate('/', { replace: true });
  }

  if (householdId) {
    return (
      <AuthLayout title={copy.create.inviteTitle} subtitle={copy.create.inviteSubtitle}>
        {invite ? (
          <>
            <InviteCodePanel code={invite.code} expiresAt={invite.expiresAt} />
            <p role="status" className="rounded-2xl bg-sunken px-4 py-3 text-sm font-semibold text-ink">
              {copy.invites.pendingState}
            </p>
          </>
        ) : (
          <>
            <FormError message={inviteError} />
            <Button fullWidth loading={inviteBusy} loadingLabel={copy.invites.creating} onClick={onCreateInvite}>
              {copy.invites.create}
            </Button>
          </>
        )}
        <Button variant={invite ? 'primary' : 'tertiary'} fullWidth onClick={() => void finish()}>
          {invite ? copy.create.done : copy.create.skip}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={copy.create.title} subtitle={copy.create.subtitle}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id="household-name"
          label={copy.create.name}
          placeholder={copy.create.namePlaceholder}
          autoComplete="off"
          maxLength={90}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />
        <button
          type="button"
          aria-expanded={more}
          aria-controls="more-options"
          onClick={() => setMore((m) => !m)}
          className="inline-flex min-h-11 cursor-pointer items-center self-start font-bold text-primary underline-offset-4 hover:underline"
        >
          {more ? copy.create.lessOptions : copy.create.moreOptions}
        </button>
        <div id="more-options" hidden={!more} className="flex flex-col gap-4 rounded-3xl border-2 border-line bg-surface p-4">
          <p className="text-sm text-ink2">{copy.create.optionsHint}</p>
          <SelectField label={copy.create.currency} hint={copy.create.currencyHint} options={CURRENCY_OPTIONS} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <SelectField label={copy.create.defaultSplit} options={SPLIT_OPTIONS} value={split} onChange={(e) => setSplit(e.target.value as DefaultSplit)} />
          <Toggle label={copy.create.choreReminders} description={copy.create.choreRemindersHint} checked={reminders} onChange={setReminders} />
        </div>
        <FormError message={formError} />
        <Button type="submit" fullWidth loading={busy} loadingLabel={copy.create.submitting}>
          {copy.create.submit}
        </Button>
        <Link to="/start" className="inline-flex min-h-11 items-center justify-center font-bold text-primary underline-offset-4 hover:underline">
          {copy.join.back}
        </Link>
      </form>
    </AuthLayout>
  );
}
