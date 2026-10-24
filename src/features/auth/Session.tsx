import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; /** true after following a password-reset link */ recovery: boolean };

export const SessionContext = createContext<SessionState>({ status: 'loading' });

export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** Tracks the Supabase auth session. `recovery` is set when the user arrived via a password-reset link. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    let recovery = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(data.session ? { status: 'signedIn', user: data.session.user, recovery } : { status: 'signedOut' });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recovery = true;
      if (event === 'SIGNED_OUT') recovery = false;
      if (!active) return;
      setState(session ? { status: 'signedIn', user: session.user, recovery } : { status: 'signedOut' });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
