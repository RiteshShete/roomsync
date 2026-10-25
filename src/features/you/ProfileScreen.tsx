import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateMyProfile } from '@/api/profile';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/features/auth/Session';
import { useProfile } from '@/features/household/useMembership';
import { SubPage } from '@/features/shell/SubPage';
import { Avatar, Button, ErrorState, Field, FormError, SkeletonList, useToast } from '@/ui';
import { AVATAR_COLORS, checkProfile, NAME_MAX } from './profileModel';

/** You → Edit profile: display name and avatar colour. Other members see the change on their next refresh. */
export function ProfileScreen() {
  const session = useSession();
  const profile = useProfile();
  const client = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data && !loaded) {
      setName(profile.data.displayName);
      setColor(profile.data.avatarColor);
      setLoaded(true);
    }
  }, [profile.data, loaded]);

  if (profile.isPending || !loaded) {
    return (
      <SubPage title={copy.profileEdit.title}>
        {profile.isError ? <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} /> : <SkeletonList rows={3} />}
      </SubPage>
    );
  }

  const check = checkProfile({ displayName: name, avatarColor: color }, profile.data!);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !check.input || session.status !== 'signedIn') return;
    setBusy(true);
    setFormError(null);
    try {
      await updateMyProfile(session.user.id, check.input);
      await Promise.all(['profile', 'members', 'members-all'].map((k) => client.invalidateQueries({ queryKey: [k] })));
      toast.show({ message: copy.profileEdit.saved });
    } catch (err) {
      setFormError(errorMessage(err)); // the form keeps what was typed
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubPage title={copy.profileEdit.title}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <section aria-label={copy.profileEdit.title} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-5 text-center">
          <Avatar name={name || '?'} color={color} size="lg" />
          <p className="mt-2 max-w-full truncate text-lg font-bold text-ink-strong">{name.trim() || '…'}</p>
          {session.status === 'signedIn' ? <p className="max-w-full truncate text-sm text-ink2">{session.user.email}</p> : null}
        </section>

        <section aria-labelledby="profile-details" className="flex flex-col gap-3">
          <h2 id="profile-details" className="px-1 text-sm font-bold text-ink2">
            {copy.profileEdit.details}
          </h2>
          <Field label={copy.profileEdit.name} autoComplete="name" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
        </section>

        <fieldset className="flex flex-col gap-3">
          <legend className="px-1 text-sm font-bold text-ink2">{copy.profileEdit.color}</legend>
          <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-surface p-4">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={copy.profileEdit.colorOption(c.name)}
                aria-pressed={color.toLowerCase() === c.hex.toLowerCase()}
                onClick={() => setColor(c.hex)}
                style={{ backgroundColor: c.hex }}
                className="h-11 w-11 cursor-pointer rounded-full border-2 border-surface ring-2 ring-line aria-pressed:ring-4 aria-pressed:ring-ink"
              />
            ))}
          </div>
        </fieldset>

        <FormError message={formError} />
        <Button type="submit" fullWidth loading={busy} loadingLabel={copy.profileEdit.saving} disabled={!check.ok} disabledReason={check.reason ?? undefined} showReason>
          {copy.profileEdit.save}
        </Button>
      </form>
    </SubPage>
  );
}
