import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import caretDown from '@/assets/feed/caret-down.svg';
import familyHome from '@/assets/feed/family-home.svg';
import flash from '@/assets/feed/flash.svg';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { useAnnouncements } from '@/features/announcements/hooks';
import { useBalances, useMoney } from '@/features/expenses/hooks';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess, useMembers } from '@/features/household/useMembership';
import { AvatarGroup, Skeleton } from '@/ui';

const ROW = 'flex min-h-11 items-center gap-1 rounded bg-feed-row px-1 py-1.5 text-sm text-ink';

/** One line of the feed: the design's icon, then a sentence with its key words in bold. */
function FeedRow({ to, icon, children }: { to?: string; icon: string; children: ReactNode }) {
  const content = (
    <>
      <img src={icon} alt="" width={24} height={24} className="shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </>
  );
  return <li>{to ? <Link to={to} className={`${ROW} hover:bg-surface`}>{content}</Link> : <div className={ROW}>{content}</div>}</li>;
}

function Retry({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <li className={`${ROW} justify-between`}>
      <span role="alert">{errorMessage(error)}</span>
      <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer px-2 font-bold text-coral">
        {copy.states.retry}
      </button>
    </li>
  );
}

/**
 * Home's "House Feed" card, from the design: a peach card with a collapse button, a few lines about what
 * matters now (your money, the latest announcement, an invite nudge when you are alone) and the
 * housemates' avatars tucked over its corner. Every line is real data and links to its screen.
 */
export function HouseFeed() {
  const access = useHouseholdAccess();
  const members = useMembers(access?.householdId);
  const dir = useDirectory(access?.householdId);
  const balances = useBalances(access?.householdId);
  const announcements = useAnnouncements(access?.householdId);
  const { fmt } = useMoney();
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  if (!access) return null;

  const net = balances.data?.find((b) => b.memberId === access.memberId)?.netMinor ?? 0;
  const latest = announcements.data?.[0];
  const alone = members.data?.length === 1;

  return (
    <section aria-labelledby={`${bodyId}-title`} className="relative mb-4">
      <div className="rounded-xl border-[0.6px] border-primary bg-tint pb-6">
        <div className="flex items-center justify-between">
          <h2 id={`${bodyId}-title`} className="p-2.5 text-base font-bold text-ink">
            {copy.feed.title}
          </h2>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? copy.feed.collapse : copy.feed.expand}
            onClick={() => setOpen((v) => !v)}
            className="mr-1 flex h-11 w-11 cursor-pointer items-center justify-center"
          >
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded bg-feed-chip">
              <img src={caretDown} alt="" width={12} height={12} className={open ? '' : 'rotate-180'} />
            </span>
          </button>
        </div>

        <ul id={bodyId} hidden={!open} className="flex flex-col gap-2 px-2">
          {balances.isPending ? (
            <li>
              <Skeleton className="h-11 w-full" />
            </li>
          ) : balances.isError ? (
            <Retry error={balances.error} onRetry={() => void balances.refetch()} />
          ) : (
            <FeedRow to="/expenses/balances" icon={flash}>
              {net < 0 ? (
                <>
                  {copy.feed.youOwe} <b>{fmt(-net)}</b>
                </>
              ) : net > 0 ? (
                <>
                  {copy.feed.youAreOwed} <b>{fmt(net)}</b>
                </>
              ) : (
                copy.feed.settled
              )}
            </FeedRow>
          )}

          {announcements.isPending || dir.isPending ? (
            <li>
              <Skeleton className="h-11 w-full" />
            </li>
          ) : announcements.isError ? (
            <Retry error={announcements.error} onRetry={() => void announcements.refetch()} />
          ) : (
            <FeedRow to="/house/announcements" icon={familyHome}>
              {latest ? (
                <>
                  <b>{latest.title}</b> {copy.feed.by(dir.nameOfUser(latest.createdBy))}
                </>
              ) : (
                copy.feed.noAnnouncements
              )}
            </FeedRow>
          )}

          {alone && access.isAdmin ? (
            <FeedRow to="/you/invites" icon={familyHome}>
              {copy.feed.alone} <b>{copy.feed.invite}</b>
            </FeedRow>
          ) : null}
        </ul>
      </div>

      {members.data ? (
        <Link to="/you/members" aria-label={copy.feed.members(members.data.length)} className="absolute -bottom-4 right-3 inline-flex">
          <AvatarGroup members={members.data.map((m) => ({ name: m.displayName, color: m.avatarColor }))} size="feed" />
        </Link>
      ) : null}
    </section>
  );
}
