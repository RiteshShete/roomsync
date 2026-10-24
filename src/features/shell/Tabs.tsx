import { Link } from 'react-router-dom';
import { signOut } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { Avatar, Button, EmptyState, Icon, useToast, type IconName } from '@/ui';
import { useSession } from '@/features/auth/Session';
import { useMembership, useProfile } from '@/features/household/useMembership';

/**
 * Tab content arrives phase by phase. Until then each tab says so plainly rather than showing
 * controls that do nothing.
 */
export function PlaceholderTab() {
  return <EmptyState title={copy.placeholder.title} body={copy.placeholder.body} />;
}

function NavRow({ to, icon, title, body }: { to: string; icon: IconName; title: string; body: string }) {
  return (
    <Link to={to} className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:bg-tint">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-coral">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-bold text-ink">{title}</span>
        <span className="text-sm text-ink2">{body}</span>
      </span>
    </Link>
  );
}

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
