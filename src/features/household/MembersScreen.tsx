import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelMoveOut, setMemberRole, transferOwnership, type Member } from '@/api/households';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/features/auth/Session';
import { SubPage } from '@/features/shell/SubPage';
import { Avatar, Button, Chip, ConfirmDialog, EmptyState, ErrorState, Sheet, SkeletonList, useToast } from '@/ui';
import { MemberMoveOutSheet } from './MemberMoveOutSheet';
import { useHouseholdAccess, useMembers } from './useMembership';

function MemberRow({ member, isYou, onManage, manageDisabledReason }: { member: Member; isYou: boolean; onManage?: () => void; manageDisabledReason?: string | null }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <Avatar name={member.displayName} color={member.avatarColor} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-ink">
          {member.displayName}
          {isYou ? <span className="font-semibold text-ink2"> ({copy.members.you})</span> : null}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone={member.role === 'owner' ? 'brand' : member.role === 'admin' ? 'info' : 'neutral'}>{copy.members.roles[member.role]}</Chip>
          {member.status === 'leaving' ? <Chip tone="warning">{copy.members.movingOut}</Chip> : null}
        </div>
      </div>
      {onManage ? (
        <Button variant="secondary" className="shrink-0" onClick={onManage} disabled={!!manageDisabledReason} disabledReason={manageDisabledReason ?? undefined} aria-label={copy.members.manageFor(member.displayName)}>
          {copy.members.manage}
        </Button>
      ) : null}
    </li>
  );
}

/** Members with role chips. The owner can change roles and transfer ownership (the database enforces it too). */
export function MembersScreen() {
  const access = useHouseholdAccess();
  const members = useMembers(access?.householdId);
  const session = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const myUserId = session.status === 'signedIn' ? session.user.id : null;

  const [managing, setManaging] = useState<Member | null>(null);
  const [transferTo, setTransferTo] = useState<Member | null>(null);
  const [movingOut, setMovingOut] = useState<Member | null>(null);

  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['members'] }), queryClient.invalidateQueries({ queryKey: ['membership'] })]);

  const roleMutation = useMutation({
    mutationFn: (v: { member: Member; role: 'admin' | 'member' }) => setMemberRole(v.member.memberId, v.role),
    onSuccess: async (_d, v) => {
      await refresh();
      setManaging(null);
      toast.show({ message: copy.members.roleUpdated(v.member.displayName, v.role) });
    },
    onError: (err) => toast.show({ tone: 'error', message: errorMessage(err) }),
  });

  const transferMutation = useMutation({
    mutationFn: (m: Member) => transferOwnership(m.memberId),
    onSuccess: async (_d, m) => {
      await refresh();
      setTransferTo(null);
      toast.show({ message: copy.members.transferred(m.displayName) });
    },
    onError: (err) => {
      setTransferTo(null);
      toast.show({ tone: 'error', message: errorMessage(err) });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (m: Member) => cancelMoveOut(m.memberId),
    onSuccess: async (_d, m) => {
      await refresh();
      setManaging(null);
      toast.show({ message: copy.moveOut.forOther.cancelledFor(m.displayName) });
    },
    onError: (err) => toast.show({ tone: 'error', message: errorMessage(err) }),
  });

  let body;
  if (members.isPending) body = <SkeletonList rows={3} />;
  else if (members.isError) body = <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} />;
  else if (members.data.length === 0) body = <EmptyState title={copy.members.empty} />;
  else
    body = (
      <>
        <p className="text-sm font-semibold text-ink2">{members.data.length === 1 ? '1 member' : `${members.data.length} members`}</p>
        <ul className="flex flex-col gap-3">
          {members.data.map((m) => (
            <MemberRow
              key={m.memberId}
              member={m}
              isYou={m.userId === myUserId}
              onManage={access?.isAdmin && m.role !== 'owner' && m.userId !== myUserId ? () => setManaging(m) : undefined}
              manageDisabledReason={access?.writeBlockedReason}
            />
          ))}
        </ul>
        {!access?.isAdmin ? <p className="text-sm text-ink2">{copy.members.onlyAdminsManage}</p> : null}
      </>
    );

  return (
    <SubPage title={copy.members.title}>
      {body}

      <Sheet open={!!managing} onClose={() => setManaging(null)} title={managing ? copy.members.manageFor(managing.displayName) : ''}>
        {managing ? (
          <div className="flex flex-col gap-3 pb-2">
            <p className="text-base text-ink2">{copy.members.manageSheetBody}</p>
            <Button
              variant="secondary"
              fullWidth
              loading={roleMutation.isPending}
              disabled={!access?.isOwner}
              disabledReason={copy.members.onlyOwnerManages}
              showReason
              onClick={() => roleMutation.mutate({ member: managing, role: managing.role === 'admin' ? 'member' : 'admin' })}
            >
              {managing.role === 'admin' ? copy.members.makeMember : copy.members.makeAdmin}
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={!access?.isOwner || managing.status !== 'active'}
              disabledReason={!access?.isOwner ? copy.members.onlyOwnerManages : copy.members.ownerNeedsActive}
              showReason
              onClick={() => {
                setTransferTo(managing);
                setManaging(null);
              }}
            >
              {copy.members.makeOwner}
            </Button>
            {managing.status === 'leaving' ? (
              <Button variant="secondary" fullWidth loading={cancelMutation.isPending} disabled={!!access?.writeBlockedReason} disabledReason={access?.writeBlockedReason ?? undefined} showReason onClick={() => cancelMutation.mutate(managing)}>
                {copy.moveOut.forOther.cancelFor(managing.displayName)}
              </Button>
            ) : (
              <Button
                variant="danger"
                fullWidth
                disabled={!!access?.writeBlockedReason}
                disabledReason={access?.writeBlockedReason ?? undefined}
                showReason
                onClick={() => {
                  setMovingOut(managing);
                  setManaging(null);
                }}
              >
                {copy.moveOut.forOther.start}
              </Button>
            )}
          </div>
        ) : null}
      </Sheet>

      {movingOut ? (
        <MemberMoveOutSheet
          key={movingOut.memberId}
          member={movingOut}
          blockedReason={access?.writeBlockedReason ?? null}
          onClose={() => setMovingOut(null)}
          onStarted={() => {
            toast.show({ message: copy.moveOut.forOther.started(movingOut.displayName) });
            setMovingOut(null);
            void refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!transferTo}
        title={copy.members.transferTitle}
        confirmLabel={copy.members.transferConfirm}
        loading={transferMutation.isPending}
        onCancel={() => setTransferTo(null)}
        onConfirm={() => transferTo && transferMutation.mutate(transferTo)}
      >
        {transferTo ? copy.members.transferBody(transferTo.displayName) : null}
      </ConfirmDialog>
    </SubPage>
  );
}
