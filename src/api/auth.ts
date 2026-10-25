import type { User } from '@supabase/supabase-js';
import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

/** Where auth emails send people back to: the app root (the PKCE `code` arrives as a query param). */
function appUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export async function signUp(input: { email: string; password: string; displayName: string }): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.displayName }, emailRedirectTo: appUrl() },
  });
  if (error) throw toAppError(error);
  // No session means the project requires email confirmation first.
  return { needsEmailConfirmation: data.session === null };
}

export async function signIn(input: { email: string; password: string }): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword(input);
  if (error) throw toAppError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw toAppError(error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) throw toAppError(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw toAppError(error);
}

/**
 * Reports the current auth session now and whenever it changes. `recovery` is true after the user
 * followed a password-reset link. Returns an unsubscribe function.
 */
export function watchSession(onChange: (state: { user: User | null; recovery: boolean }) => void): () => void {
  const supabase = getSupabase();
  let active = true;
  let recovery = false;

  void supabase.auth.getSession().then(({ data }) => {
    if (active) onChange({ user: data.session?.user ?? null, recovery });
  });
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') recovery = false;
    if (active) onChange({ user: session?.user ?? null, recovery });
  });
  return () => {
    active = false;
    data.subscription.unsubscribe();
  };
}
