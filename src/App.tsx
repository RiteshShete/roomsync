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
import { CreateHouseholdScreen } from '@/features/household/CreateHouseholdScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { HouseholdSettingsScreen } from '@/features/household/HouseholdSettingsScreen';
import { InvitesScreen } from '@/features/household/InvitesScreen';
import { JoinHouseholdScreen } from '@/features/household/JoinHouseholdScreen';
import { MembersScreen } from '@/features/household/MembersScreen';
import { ChoreFormScreen } from '@/features/chores/ChoreFormScreen';
import { ChoresScreen } from '@/features/chores/ChoresScreen';
import { GroceriesScreen } from '@/features/groceries/GroceriesScreen';
import { BalancesScreen } from '@/features/expenses/BalancesScreen';
import { ExpenseDetailsScreen } from '@/features/expenses/ExpenseDetailsScreen';
import { ExpenseFormScreen } from '@/features/expenses/ExpenseFormScreen';
import { ExpenseListScreen } from '@/features/expenses/ExpenseListScreen';
import { ExpensesScreen } from '@/features/expenses/ExpensesScreen';
import { RecordSettlementScreen } from '@/features/expenses/RecordSettlementScreen';
import { SettlementsScreen } from '@/features/expenses/SettlementsScreen';
import { AppShell } from '@/features/shell/AppShell';
import { LeftScreen } from '@/features/household/LeftScreen';
import { MoveOutScreen } from '@/features/moveout/MoveOutScreen';
import { YouScreen } from '@/features/you/YouScreen';
import { ProfileScreen } from '@/features/you/ProfileScreen';
import { NotificationPrefsScreen } from '@/features/you/NotificationPrefsScreen';
import { PrivacyScreen } from '@/features/you/PrivacyScreen';
import { ActivityScreen } from '@/features/activity/ActivityScreen';
import { AnnouncementsScreen } from '@/features/announcements/AnnouncementsScreen';
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
          <Route path="/left" element={<LeftScreen />} />
          <Route path="/start" element={<ChooseHouseholdScreen />} />
          <Route path="/start/create" element={<CreateHouseholdScreen />} />
          <Route path="/start/join" element={<JoinHouseholdScreen />} />
          <Route element={<AppShell />}>
            <Route index element={<HomeScreen />} />
            <Route path="expenses" element={<ExpensesScreen tab="pay" />} />
            <Route path="expenses/receive" element={<ExpensesScreen tab="receive" />} />
            <Route path="expenses/all" element={<ExpenseListScreen />} />
            <Route path="expenses/new" element={<ExpenseFormScreen />} />
            <Route path="expenses/balances" element={<BalancesScreen />} />
            <Route path="expenses/settlements" element={<SettlementsScreen />} />
            <Route path="expenses/settle" element={<RecordSettlementScreen />} />
            <Route path="expenses/:id" element={<ExpenseDetailsScreen />} />
            <Route path="expenses/:id/edit" element={<ExpenseFormScreen />} />
            <Route path="chores" element={<ChoresScreen tab="all" />} />
            <Route path="chores/mine" element={<ChoresScreen tab="mine" />} />
            <Route path="chores/completed" element={<ChoresScreen tab="completed" />} />
            <Route path="chores/new" element={<ChoreFormScreen />} />
            <Route path="chores/:id/edit" element={<ChoreFormScreen />} />
            <Route path="house/groceries" element={<GroceriesScreen />} />
            <Route path="house/announcements" element={<AnnouncementsScreen />} />
            <Route path="activity" element={<ActivityScreen />} />
            <Route path="you" element={<YouScreen />} />
            <Route path="you/profile" element={<ProfileScreen />} />
            <Route path="you/notifications" element={<NotificationPrefsScreen />} />
            <Route path="you/privacy" element={<PrivacyScreen />} />
            <Route path="you/members" element={<MembersScreen />} />
            <Route path="you/invites" element={<InvitesScreen />} />
            <Route path="you/household" element={<HouseholdSettingsScreen />} />
            <Route path="you/household/leave" element={<MoveOutScreen />} />
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
