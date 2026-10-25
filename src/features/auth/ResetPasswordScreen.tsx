import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, FormError, PasswordField, SkeletonList, useToast } from '@/ui';
import { AuthLayout, Notice } from './AuthLayout';
import { useSession } from './Session';
import { focusFirstError, resetSchema, validate, type FormErrors } from './validation';

const IDS = { password: 'reset-password', confirm: 'reset-confirm' };

/** Reached from the emailed reset link, which signs the user in with a short-lived recovery session. */
export function ResetPasswordScreen() {
  const session = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session.status === 'loading') {
    return (
      <AuthLayout title={copy.auth.resetTitle}>
        <SkeletonList rows={2} />
      </AuthLayout>
    );
  }
  if (session.status === 'signedOut') {
    return (
      <AuthLayout title={copy.auth.resetInvalidTitle}>
        <Notice title={copy.auth.resetInvalidTitle} body={copy.auth.resetInvalidBody}>
          <Link to="/forgot-password" className="inline-flex min-h-11 items-center font-bold text-coral underline-offset-4 hover:underline">
            {copy.auth.sendReset}
          </Link>
        </Notice>
      </AuthLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(resetSchema, values);
    if (!result.ok) {
      setErrors(result.errors);
      setFormError(null);
      focusFirstError(IDS, result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await updatePassword(result.data.password);
      toast.show({ message: copy.auth.passwordUpdated });
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={copy.auth.resetTitle}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <PasswordField
          id={IDS.password}
          label={copy.auth.newPassword}
          hint={copy.auth.passwordHint}
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          error={errors.password}
        />
        <PasswordField
          id={IDS.confirm}
          label={copy.auth.confirmPassword}
          autoComplete="new-password"
          value={values.confirm}
          onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))}
          error={errors.confirm}
        />
        <FormError message={formError} />
        <Button type="submit" fullWidth loading={busy} loadingLabel={copy.auth.updatingPassword}>
          {copy.auth.updatePassword}
        </Button>
      </form>
    </AuthLayout>
  );
}
