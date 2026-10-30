import { Link } from 'react-router-dom';
import { signOut } from '@/api/auth';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/features/auth/Session';
import { useHouseholdAccess, useMembership, useProfile } from '@/features/household/useMembership';
import { Avatar, Button, Icon, ListGroup, ListRow, useToast } from '@/ui';
import { PersonalSummary } from './PersonalSummary';

/**
 * "You" tab, in order of importance: who you are, the one thing you most often come here to do
 * (invite housemates, for owners and admins), your summary, then grouped lists: account, household,
 * and last of all privacy and help, with Sign out at the very bottom.
 */
export function YouScreen() {
  const session = useSession();
  const profile = useProfile();
  const membership = useMembership();
  const access = useHouseholdAccess();
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
      <section aria-label={copy.you.signedInAs} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
        <Avatar name={name || '?'} color={profile.data?.avatarColor} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-ink-strong">{name || '…'}</p>
          <p className="truncate text-sm text-ink2">{session.status === 'signedIn' ? session.user.email : ''}</p>
          {membership.data ? <p className="truncate text-sm text-ink2">{membership.data.household.name}</p> : null}
        </div>
        <Link to="/you/profile" aria-label={copy.you.editProfile} title={copy.you.editProfile} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-coral hover:bg-brand-soft">
          <Icon name="pen" size={20} />
        </Link>
      </section>

      {access?.isAdmin ? (
        <Link to="/you/invites" className="flex min-h-16 items-center gap-3 rounded-xl border border-tint-line bg-tint p-3 hover:bg-brand-soft">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="mail" size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col break-words">
            <span className="text-base font-bold text-ink-strong">{copy.you.invites}</span>
            <span className="text-sm text-ink">{copy.you.invitesBody}</span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-ink2" aria-hidden="true" />
        </Link>
      ) : null}

      <PersonalSummary />

      <ListGroup title={copy.you.household}>
        <ListRow to="/you/members" icon="user" title={copy.you.members} body={copy.you.membersBody} />
        <ListRow to="/you/household" icon="house" title={copy.you.settings} body={copy.you.settingsBody} />
      </ListGroup>

      <ListGroup title={copy.you.account}>
        <ListRow to="/you/profile" icon="user" title={copy.you.profile} body={copy.you.profileBody} />
        <ListRow to="/you/notifications" icon="bell" title={copy.you.notifications} body={copy.you.notificationsBody} />
      </ListGroup>

      <ListGroup title={copy.you.about}>
        <ListRow to="/you/privacy" icon="shield" title={copy.you.privacy} body={copy.you.privacyBody} />
      </ListGroup>

      <Button variant="secondary" fullWidth onClick={handleSignOut}>
        {copy.auth.signOut}
      </Button>
    </div>
  );
}
