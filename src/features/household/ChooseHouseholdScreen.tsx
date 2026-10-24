import { useId, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { signOut } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, ErrorState, SkeletonList, useToast } from '@/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useMembership, useProfile } from './useMembership';

/**
 * A choice card that is honestly disabled: it stays focusable, says why on screen, and does nothing.
 * Creating and joining a household is built in the next phase.
 */
function ChoiceCard({ title, body, reason, icon }: { title: string; body: string; reason: string; icon: ReactNode }) {
  const reasonId = useId();
  return (
    <div>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={reasonId}
        onClick={(e) => e.preventDefault()}
        className="flex min-h-24 w-full cursor-not-allowed items-center gap-4 rounded-3xl border-2 border-line bg-surface p-4 text-left opacity-80"
      >
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary">
          {icon}
        </span>
        <span className="flex flex-col">
          <span className="text-lg font-extrabold text-ink">{title}</span>
          <span className="text-sm text-ink2">{body}</span>
        </span>
      </button>
      <p id={reasonId} className="mt-1.5 px-2 text-sm font-semibold text-ink2">
        {reason}
      </p>
    </div>
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
          title={copy.household.create}
          body={copy.household.createBody}
          reason={copy.household.notYet}
          icon={<span className="text-2xl font-extrabold">+</span>}
        />
        <ChoiceCard
          title={copy.household.join}
          body={copy.household.joinBody}
          reason={copy.household.notYet}
          icon={<span className="text-2xl font-extrabold">#</span>}
        />
      </div>
      <Button variant="tertiary" onClick={handleSignOut}>
        {copy.auth.signOut}
      </Button>
    </AuthLayout>
  );
}
