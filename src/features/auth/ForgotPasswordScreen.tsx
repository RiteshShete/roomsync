import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, Field, FormError } from '@/ui';
import { AuthLayout, Notice } from './AuthLayout';
import { forgotSchema, focusFirstError, validate, type FormErrors } from './validation';

const IDS = { email: 'forgot-email' };

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(forgotSchema, { email });
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
      await requestPasswordReset(result.data.email);
      setSent(true); // same message whether or not the account exists
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={copy.auth.forgotTitle}>
      {sent ? (
        <Notice title={copy.auth.resetSentTitle} body={copy.auth.resetSentBody}>
          <Link to="/login" className="inline-flex min-h-11 items-center font-bold text-coral underline-offset-4 hover:underline">
            {copy.auth.backToLogIn}
          </Link>
        </Notice>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            id={IDS.email}
            label={copy.auth.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <FormError message={formError} />
          <Button type="submit" fullWidth loading={busy} loadingLabel={copy.auth.sendingReset}>
            {copy.auth.sendReset}
          </Button>
          <Link to="/login" className="inline-flex min-h-11 items-center justify-center font-bold text-coral underline-offset-4 hover:underline">
            {copy.auth.backToLogIn}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
