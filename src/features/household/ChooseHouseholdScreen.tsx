import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { signOut } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, ErrorState, SkeletonList, useToast } from '@/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useMembership, useProfile } from './useMembership';

/** A large tappable choice (create or join). */
function ChoiceCard({ to, title, body, icon }: { to: string; title: string; body: string; icon: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-24 w-full items-center gap-4 rounded-3xl border-2 border-line bg-surface p-4 text-left hover:bg-tint"
    >
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-lg font-extrabold text-ink">{title}</span>
        <span className="text-sm text-ink2">{body}</span>
      </span>
    </Link>
  );
}

/** First screen for a signed-in user with no household. */
export function ChooseHouseholdScreen() {
  const membership = useMembership();
  const profile = useProfile();
  const toast = useToast();

  if (membership.isPending) {
    return (
      <AuthLayout title={copy.household.chooseTitle}>
        <SkeletonList rows={2} />
      </AuthLayout>
    );
  }
  if (membership.isError) {
    return (
      <AuthLayout title={copy.household.chooseTitle}>
        <ErrorState message={errorMessage(membership.error)} onRetry={() => void membership.refetch()} />
      </AuthLayout>
    );
  }
  if (membership.data) return <Navigate to="/" replace />;

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      toast.show({ tone: 'error', message: errorMessage(err) });
    }
  }

  return (
    <AuthLayout
      title={profile.data ? `Hi, ${profile.data.displayName}` : copy.household.chooseTitle}
      subtitle={copy.household.chooseBody}
    >
      <div className="flex flex-col gap-4">
        <ChoiceCard
          to="/start/create"
          title={copy.household.create}
          body={copy.household.createBody}
          icon={<span className="text-2xl font-extrabold">+</span>}
        />
        <ChoiceCard
          to="/start/join"
          title={copy.household.join}
          body={copy.household.joinBody}
          icon={<span className="text-2xl font-extrabold">#</span>}
        />
      </div>
      <Button variant="tertiary" onClick={handleSignOut}>
        {copy.auth.signOut}
      </Button>
    </AuthLayout>
  );
}
