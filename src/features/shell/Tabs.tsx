import { signOut } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Avatar, Button, NavRow, useToast } from '@/ui';
import { useSession } from '@/features/auth/Session';
import { useMembership, useProfile } from '@/features/household/useMembership';


/** "You" tab: who is signed in, the household pages, and a working Sign out. */
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
      <section className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
        <Avatar name={name || '?'} color={profile.data?.avatarColor} size="lg" />
        <div className="min-w-0">
          <p className="text-sm text-ink2">{copy.you.signedInAs}</p>
          <p className="truncate text-lg font-bold text-ink">{name || '…'}</p>
          <p className="truncate text-sm text-ink2">{session.status === 'signedIn' ? session.user.email : ''}</p>
          {membership.data ? <p className="text-sm text-ink2">{membership.data.household.name}</p> : null}
        </div>
      </section>

      <section aria-labelledby="you-household" className="flex flex-col gap-3">
        <h2 id="you-household" className="text-lg font-bold text-ink">
          {copy.you.household}
        </h2>
        <NavRow to="/you/members" icon="user" title={copy.you.members} body={copy.you.membersBody} />
        <NavRow to="/you/invites" icon="mail" title={copy.you.invites} body={copy.you.invitesBody} />
        <NavRow to="/you/household" icon="house" title={copy.you.settings} body={copy.you.settingsBody} />
      </section>

      <Button variant="secondary" fullWidth onClick={handleSignOut}>
        {copy.auth.signOut}
      </Button>
    </div>
  );
}
