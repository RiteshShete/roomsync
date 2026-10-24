import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { signIn } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, Field, PasswordField } from '@/ui';
import { AuthLayout, FormError } from './AuthLayout';
import { focusFirstError, logInSchema, validate, type FormErrors } from './validation';

const IDS = { email: 'login-email', password: 'login-password' };

export function LogInScreen() {
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(logInSchema, values);
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
      await signIn(result.data); // the session listener redirects on success
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={copy.auth.logInTitle}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id={IDS.email}
          label={copy.auth.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        <PasswordField
          id={IDS.password}
          label={copy.auth.password}
          autoComplete="current-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
        />
        <Link to="/forgot-password" className="inline-flex min-h-11 items-center self-start font-bold text-coral underline-offset-4 hover:underline">
          {copy.auth.forgotLink}
        </Link>
        <FormError message={formError} />
        <Button type="submit" fullWidth loading={busy} loadingLabel={copy.auth.loggingIn}>
          {copy.auth.logIn}
        </Button>
      </form>
      <p className="text-center text-base text-ink2">
        {copy.auth.noAccount}{' '}
        <Link to="/signup" className="font-bold text-coral underline-offset-4 hover:underline">
          {copy.auth.createAccount}
        </Link>
      </p>
    </AuthLayout>
  );
}
