import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { watchSession } from '@/api/auth';

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

  useEffect(
    () => watchSession(({ user, recovery }) => setState(user ? { status: 'signedIn', user, recovery } : { status: 'signedOut' })),
    [],
  );

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
