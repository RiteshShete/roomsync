import { useMemo, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { EnvMissingScreen } from '@/app/EnvMissingScreen';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { OfflineBanner } from '@/app/OfflineBanner';
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { LogInScreen } from '@/features/auth/LogInScreen';
import { ResetPasswordScreen } from '@/features/auth/ResetPasswordScreen';
import { SessionProvider } from '@/features/auth/Session';
import { SignUpScreen } from '@/features/auth/SignUpScreen';
import { WelcomeScreen } from '@/features/auth/WelcomeScreen';
import { PublicOnly, RequireAuth } from '@/features/auth/guards';
import { ChooseHouseholdScreen } from '@/features/household/ChooseHouseholdScreen';
import { AppShell } from '@/features/shell/AppShell';
import { PlaceholderTab, YouTab } from '@/features/shell/Tabs';
import { readEnv } from '@/lib/env';
import { createQueryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/ui';

/** Route table. Kept separate from providers so tests can render it with their own. */
export function AppRoutes() {
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/signup" element={<SignUpScreen />} />
          <Route path="/login" element={<LogInScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route element={<RequireAuth />}>
          <Route path="/start" element={<ChooseHouseholdScreen />} />
          <Route element={<AppShell />}>
            <Route index element={<PlaceholderTab />} />
            <Route path="expenses" element={<PlaceholderTab />} />
            <Route path="chores" element={<PlaceholderTab />} />
            <Route path="house" element={<PlaceholderTab />} />
            <Route path="you" element={<YouTab />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => createQueryClient(), []);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SessionProvider>{children}</SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export function App() {
  const env = readEnv();
  if (!env.ok) return <EnvMissingScreen missing={env.missing} secretKey={env.secretKey} />;
  return (
    <Providers>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </Providers>
  );
}
