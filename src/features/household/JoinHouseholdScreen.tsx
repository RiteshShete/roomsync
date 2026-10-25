import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { joinHousehold, previewInvite } from '@/api/invites';
import type { InvitePreview } from '@/api/invites';
import { copy } from '@/copy';
import { formatInviteCode, isValidInviteFormat, normalizeInviteCode } from '@/domain';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { AuthLayout, HeroLayout } from '@/features/auth/AuthLayout';
import { Button, Field, FormError, useToast } from '@/ui';
import { useMembership } from './useMembership';

/**
 * Journey B. Enter code -> preview (name, member count, expiry only: no member identities) ->
 * confirm -> join. Every failure keeps the typed code and says exactly what went wrong.
 */
export function JoinHouseholdScreen() {
  const membership = useMembership();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [params] = useSearchParams();

  const [code, setCode] = useState(() => params.get('code') ?? '');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);

  if (!joined && membership.data) return <Navigate to="/" replace />;

  async function onCheck(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    if (!isValidInviteFormat(code)) {
      setCodeError(copy.join.codeInvalid);
      return;
    }
    setCodeError(null);
    setBusy(true);
    try {
      setPreview(await previewInvite(normalizeInviteCode(code)));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (busy) return;
    setFormError(null);
    setBusy(true);
    try {
      await joinHousehold(normalizeInviteCode(code));
      setJoined(true);
      await queryClient.invalidateQueries({ queryKey: ['membership'] });
      toast.show({ message: copy.join.joinedToast });
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (preview) {
    return (
      <AuthLayout title={copy.join.confirmTitle}>
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-2xl font-bold text-ink">{preview.householdName}</h2>
          <p className="text-base text-ink2">{copy.join.members(preview.memberCount)}</p>
          <p className="text-sm text-ink2">
            {copy.join.expires}: {formatDateTime(preview.expiresAt)}
          </p>
        </section>
        <p className="text-sm text-ink2">{copy.join.previewNote}</p>
        <FormError message={formError} />
        <Button fullWidth loading={busy} loadingLabel={copy.join.joining} onClick={onJoin}>
          {copy.join.confirm}
        </Button>
        <Button
          variant="tertiary"
          fullWidth
          onClick={() => {
            setPreview(null);
            setFormError(null);
          }}
        >
          {copy.join.different}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <HeroLayout art="join" title={copy.join.title} subtitle={copy.join.subtitle}>
      <form noValidate onSubmit={onCheck} className="flex flex-col gap-3">
        <Field
          id="invite-code"
          label={copy.join.code}
          hint={copy.join.codeHint}
          shape="pill"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          className="font-mono text-xl tracking-widest uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => isValidInviteFormat(code) && setCode(formatInviteCode(code))}
          error={codeError}
        />
        <FormError message={formError} />
        <Button type="submit" fullWidth className="rounded-full" loading={busy} loadingLabel={copy.join.checking}>
          {copy.join.check}
        </Button>
        <Link to="/start" className="inline-flex min-h-11 items-center justify-center font-semibold text-coral underline-offset-4 hover:underline">
          {copy.join.back}
        </Link>
      </form>
    </HeroLayout>
  );
}
