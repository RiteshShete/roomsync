import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { signUp } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, Field, PasswordField } from '@/ui';
import { AuthLayout, FormError, Notice } from './AuthLayout';
import { focusFirstError, signUpSchema, validate, type FormErrors } from './validation';

const IDS = { displayName: 'signup-name', email: 'signup-email', password: 'signup-password', confirm: 'signup-confirm' };

export function SignUpScreen() {
  const [params] = useSearchParams();
  const [values, setValues] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(signUpSchema, values);
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
      const { needsEmailConfirmation } = await signUp({
        email: result.data.email,
        password: result.data.password,
        displayName: result.data.displayName,
      });
      // With a session, the router redirects away; otherwise the user must confirm their email first.
      if (needsEmailConfirmation) setNeedsConfirmation(true);
    } catch (err) {
      setFormError(errorMessage(err)); // values stay exactly as typed
    } finally {
      setBusy(false);
    }
  }

  if (needsConfirmation) {
    return (
      <AuthLayout title={copy.auth.signUpTitle}>
        <Notice title={copy.auth.checkEmailTitle} body={copy.auth.checkEmailBody}>
          <Link to="/login" className="min-h-11 font-bold text-primary underline-offset-4 hover:underline">
            {copy.auth.backToLogIn}
          </Link>
        </Notice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={copy.auth.signUpTitle} subtitle={params.get('invite') === '1' ? copy.welcome.inviteHint : undefined}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id={IDS.displayName}
          label={copy.auth.displayName}
          hint={copy.auth.displayNameHint}
          autoComplete="name"
          value={values.displayName}
          onChange={set('displayName')}
          error={errors.displayName}
        />
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
          hint={copy.auth.passwordHint}
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
        />
        <PasswordField
          id={IDS.confirm}
          label={copy.auth.confirmPassword}
          autoComplete="new-password"
          value={values.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <FormError message={formError} />
        <Button type="submit" fullWidth loading={busy} loadingLabel={copy.auth.creatingAccount}>
          {copy.auth.createAccount}
        </Button>
      </form>
      <p className="text-center text-base text-ink2">
        {copy.auth.haveAccount}{' '}
        <Link to="/login" className="font-bold text-primary underline-offset-4 hover:underline">
          {copy.auth.logIn}
        </Link>
      </p>
    </AuthLayout>
  );
}
