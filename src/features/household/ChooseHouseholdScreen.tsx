import { Navigate } from 'react-router-dom';
import { signOut } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Button, ErrorState, PillLink, SkeletonList, useToast } from '@/ui';
import { AuthLayout, HeroLayout } from '@/features/auth/AuthLayout';
import { useMembership, useProfile } from './useMembership';

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
    <HeroLayout art="create" title={profile.data ? `Hi, ${profile.data.displayName}` : copy.household.chooseTitle} subtitle={copy.household.chooseBody}>
      <PillLink to="/start/join" variant="outline">
        {copy.household.join}
      </PillLink>
      <PillLink to="/start/create" variant="amber">
        {copy.household.create}
      </PillLink>
      <Button variant="tertiary" onClick={handleSignOut}>
        {copy.auth.signOut}
      </Button>
    </HeroLayout>
  );
}
