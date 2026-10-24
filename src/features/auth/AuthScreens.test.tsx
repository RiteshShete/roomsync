import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from '@/api/auth';
import { copy } from '@/copy';
import { ToastProvider } from '@/ui';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { LogInScreen } from './LogInScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { SessionContext, type SessionState } from './Session';
import { SignUpScreen } from './SignUpScreen';
import { WelcomeScreen } from './WelcomeScreen';

vi.mock('@/api/auth');
const api = vi.mocked(auth);

function renderAt(ui: React.ReactElement, path = '/', session: SessionState = { status: 'signedOut' }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionContext.Provider value={session}>
        <ToastProvider>{ui}</ToastProvider>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.resetAllMocks());

describe('WelcomeScreen', () => {
  it('uses the spec copy and offers get started / invite / log in', () => {
    renderAt(<WelcomeScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Shared living, simplified.' })).toBeInTheDocument();
    expect(screen.getByText('Keep shared expenses, chores, groceries, and house updates in one place.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'I have an invite' })).toHaveAttribute('href', '/signup?invite=1');
    expect(screen.getByRole('link', { name: 'I already have an account' })).toHaveAttribute('href', '/login');
  });
});

describe('SignUpScreen', () => {
  async function fill(values: Partial<Record<'name' | 'email' | 'password' | 'confirm', string>> = {}) {
    const v = { name: 'Aarav', email: 'aarav@example.com', password: 'longenough', confirm: 'longenough', ...values };
    await userEvent.type(screen.getByLabelText(copy.auth.displayName), v.name);
    await userEvent.type(screen.getByLabelText(copy.auth.email), v.email);
    await userEvent.type(screen.getByLabelText(copy.auth.password, { selector: 'input' }), v.password);
    await userEvent.type(screen.getByLabelText(copy.auth.confirmPassword), v.confirm);
  }

  it('shows validation errors, focuses the first, and does not call the API', async () => {
    renderAt(<SignUpScreen />);
    await userEvent.click(screen.getByRole('button', { name: copy.auth.createAccount }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(
      expect.arrayContaining([copy.validation.nameRequired, copy.validation.emailRequired, copy.validation.passwordRequired]),
    );
    await waitFor(() => expect(screen.getByLabelText(copy.auth.displayName)).toHaveFocus());
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it('flags mismatched passwords without calling the API', async () => {
    renderAt(<SignUpScreen />);
    await fill({ confirm: 'different1' });
    await userEvent.click(screen.getByRole('button', { name: copy.auth.createAccount }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.validation.confirmMismatch);
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it('submits trimmed values', async () => {
    api.signUp.mockResolvedValue({ needsEmailConfirmation: false });
    renderAt(<SignUpScreen />);
    await fill({ name: '  Aarav ' });
    await userEvent.click(screen.getByRole('button', { name: copy.auth.createAccount }));
    expect(api.signUp).toHaveBeenCalledWith({ email: 'aarav@example.com', password: 'longenough', displayName: 'Aarav' });
  });

  it('a failed save keeps everything the user typed and explains why (rule 6)', async () => {
    api.signUp.mockRejectedValue({ code: 'auth_email_taken' });
    renderAt(<SignUpScreen />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: copy.auth.createAccount }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.emailTaken);
    expect(screen.getByLabelText(copy.auth.displayName)).toHaveValue('Aarav');
    expect(screen.getByLabelText(copy.auth.email)).toHaveValue('aarav@example.com');
    expect(screen.getByLabelText(copy.auth.password, { selector: 'input' })).toHaveValue('longenough');
    expect(screen.getByLabelText(copy.auth.confirmPassword)).toHaveValue('longenough');
  });

  it('a network failure uses the friendly message, not raw text', async () => {
    api.signUp.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt(<SignUpScreen />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: copy.auth.createAccount }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
  });

  it('shows a busy button and blocks a double submit', async () => {
    let resolve!: (v: { needsEmailConfirmation: boolean }) => void;
    api.signUp.mockReturnValue(new Promise((r) => (resolve = r)));
    renderAt(<SignUpScreen />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: copy.auth.createAccount }));
    const busy = await screen.findByRole('button', { name: copy.auth.creatingAccount });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(busy);
    expect(api.signUp).toHaveBeenCalledTimes(1);
    resolve({ needsEmailConfirmation: false });
    await waitFor(() => expect(screen.getByRole('button', { name: copy.auth.createAccount })).toBeInTheDocument());
  });

  it('asks the user to confirm their email when the project requires it', async () => {
    api.signUp.mockResolvedValue({ needsEmailConfirmation: true });
    renderAt(<SignUpScreen />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: copy.auth.createAccount }));
    expect(await screen.findByText(copy.auth.checkEmailTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.auth.checkEmailBody)).toBeInTheDocument();
  });

  it('explains the invite path when arriving from "I have an invite"', () => {
    renderAt(<SignUpScreen />, '/signup?invite=1');
    expect(screen.getByText(copy.welcome.inviteHint)).toBeInTheDocument();
  });

  it('labels every field', () => {
    renderAt(<SignUpScreen />);
    for (const label of [copy.auth.displayName, copy.auth.email, copy.auth.confirmPassword]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

describe('LogInScreen', () => {
  it('validates before calling the API', async () => {
    renderAt(<LogInScreen />);
    await userEvent.click(screen.getByRole('button', { name: copy.auth.logIn }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it('signs in with the typed credentials', async () => {
    api.signIn.mockResolvedValue();
    renderAt(<LogInScreen />);
    await userEvent.type(screen.getByLabelText(copy.auth.email), 'aarav@example.com');
    await userEvent.type(screen.getByLabelText(copy.auth.password, { selector: 'input' }), 'longenough');
    await userEvent.click(screen.getByRole('button', { name: copy.auth.logIn }));
    expect(api.signIn).toHaveBeenCalledWith({ email: 'aarav@example.com', password: 'longenough' });
  });

  it('wrong credentials: clear message, fields kept', async () => {
    api.signIn.mockRejectedValue({ message: 'Invalid login credentials', code: 'invalid_credentials' });
    renderAt(<LogInScreen />);
    await userEvent.type(screen.getByLabelText(copy.auth.email), 'aarav@example.com');
    await userEvent.type(screen.getByLabelText(copy.auth.password, { selector: 'input' }), 'wrongwrong');
    await userEvent.click(screen.getByRole('button', { name: copy.auth.logIn }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invalidCredentials);
    expect(screen.getByLabelText(copy.auth.email)).toHaveValue('aarav@example.com');
    expect(screen.getByLabelText(copy.auth.password, { selector: 'input' })).toHaveValue('wrongwrong');
  });

  it('links to forgot password and sign up', () => {
    renderAt(<LogInScreen />);
    expect(screen.getByRole('link', { name: copy.auth.forgotLink })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: copy.auth.createAccount })).toHaveAttribute('href', '/signup');
  });
});

describe('ForgotPasswordScreen', () => {
  it('rejects an invalid email locally', async () => {
    renderAt(<ForgotPasswordScreen />);
    await userEvent.type(screen.getByLabelText(copy.auth.email), 'nope');
    await userEvent.click(screen.getByRole('button', { name: copy.auth.sendReset }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.validation.emailInvalid);
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows the same neutral message after sending', async () => {
    api.requestPasswordReset.mockResolvedValue();
    renderAt(<ForgotPasswordScreen />);
    await userEvent.type(screen.getByLabelText(copy.auth.email), 'aarav@example.com');
    await userEvent.click(screen.getByRole('button', { name: copy.auth.sendReset }));
    expect(await screen.findByText(copy.auth.resetSentBody)).toBeInTheDocument();
    expect(api.requestPasswordReset).toHaveBeenCalledWith('aarav@example.com');
  });

  it('keeps the email when sending fails', async () => {
    api.requestPasswordReset.mockRejectedValue({ code: 'auth_rate_limited' });
    renderAt(<ForgotPasswordScreen />);
    await userEvent.type(screen.getByLabelText(copy.auth.email), 'aarav@example.com');
    await userEvent.click(screen.getByRole('button', { name: copy.auth.sendReset }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.rateLimited);
    expect(screen.getByLabelText(copy.auth.email)).toHaveValue('aarav@example.com');
  });
});

describe('ResetPasswordScreen', () => {
  const signedIn = { status: 'signedIn', user: { id: 'u1' }, recovery: true } as unknown as SessionState;

  it('without a valid reset session it says the link is no longer valid', () => {
    renderAt(<ResetPasswordScreen />, '/reset-password', { status: 'signedOut' });
    expect(screen.getAllByText(copy.auth.resetInvalidTitle).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: copy.auth.sendReset })).toHaveAttribute('href', '/forgot-password');
  });

  it('shows a loading state while the session resolves', () => {
    renderAt(<ResetPasswordScreen />, '/reset-password', { status: 'loading' });
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('validates the new password', async () => {
    renderAt(<ResetPasswordScreen />, '/reset-password', signedIn);
    await userEvent.type(screen.getByLabelText(copy.auth.newPassword, { selector: 'input' }), 'short');
    await userEvent.type(screen.getByLabelText(copy.auth.confirmPassword), 'short');
    await userEvent.click(screen.getByRole('button', { name: copy.auth.updatePassword }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.validation.passwordShort);
    expect(api.updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password', async () => {
    api.updatePassword.mockResolvedValue();
    renderAt(<ResetPasswordScreen />, '/reset-password', signedIn);
    await userEvent.type(screen.getByLabelText(copy.auth.newPassword, { selector: 'input' }), 'brandnewpass');
    await userEvent.type(screen.getByLabelText(copy.auth.confirmPassword), 'brandnewpass');
    await userEvent.click(screen.getByRole('button', { name: copy.auth.updatePassword }));
    await waitFor(() => expect(api.updatePassword).toHaveBeenCalledWith('brandnewpass'));
  });
});
