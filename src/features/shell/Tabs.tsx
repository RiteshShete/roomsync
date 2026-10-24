import { signOut } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Avatar, Button, EmptyState, useToast } from '@/ui';
import { useSession } from '@/features/auth/Session';
import { useMembership, useProfile } from '@/features/household/useMembership';

/**
 * Tab content arrives phase by phase. Until then each tab says so plainly rather than showing
 * controls that do nothing.
 */
export function PlaceholderTab() {
  return <EmptyState title={copy.placeholder.title} body={copy.placeholder.body} />;
}

/** "You" tab: who is signed in, and a working Sign out. Profile editing arrives in a later phase. */
export function YouTab() {
  const session = useSession();
  const profile = useProfile();
  const membership = useMembership();
  const toast = useToast();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      toast.show({ tone: 'error', message: errorMessage(err) });
    }
  }

  const name = profile.data?.displayName ?? '';
  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="flex items-center gap-4 rounded-3xl border-2 border-line bg-surface p-4">
        <Avatar name={name || '?'} color={profile.data?.avatarColor} size="lg" />
        <div className="min-w-0">
          <p className="text-sm text-ink2">{copy.you.signedInAs}</p>
          <p className="truncate text-lg font-extrabold text-ink">{name || '…'}</p>
          <p className="truncate text-sm text-ink2">{session.status === 'signedIn' ? session.user.email : ''}</p>
          {membership.data ? <p className="text-sm text-ink2">{membership.data.household.name}</p> : null}
        </div>
      </section>
      <Button variant="secondary" fullWidth onClick={handleSignOut}>
        {copy.auth.signOut}
      </Button>
    </div>
  );
}
