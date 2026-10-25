import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { deleteAnnouncement, setAnnouncementPinned, type Announcement } from '@/api/announcements';
import { copy } from '@/copy';
import { errorMessage, toAppError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/features/auth/Session';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { SubPage } from '@/features/shell/SubPage';
import { Button, Chip, ConfirmDialog, EmptyState, ErrorState, Fab, Icon, IconButton, SkeletonList, useToast } from '@/ui';
import { AnnouncementSheet } from './AnnouncementSheet';
import { useAnnouncements, useInvalidateAnnouncements } from './hooks';

/** House → Announcements: notices for the whole household. Pinned first; author, an owner or an admin may change them. */
export function AnnouncementsScreen() {
  const access = useHouseholdAccess();
  const session = useSession();
  const dir = useDirectory(access?.householdId);
  const list = useAnnouncements(access?.householdId);
  const invalidate = useInvalidateAnnouncements();
  const toast = useToast();
  const [sheet, setSheet] = useState<{ item?: Announcement; key: number } | null>(null);
  const [confirming, setConfirming] = useState<Announcement | null>(null);

  const onConflict = () => toast.show({ tone: 'error', message: copy.announcements.conflict });
  const fail = async (err: unknown) => {
    if (toAppError(err).code === 'conflict') {
      await invalidate();
      onConflict();
    } else toast.show({ tone: 'error', message: errorMessage(err) });
  };

  const pin = useMutation({
    mutationFn: (a: Announcement) => setAnnouncementPinned(a.id, a.version, a.pinnedAt === null),
    onSuccess: async (_v, a) => {
      await invalidate();
      toast.show({ message: a.pinnedAt === null ? copy.announcements.pinnedToast : copy.announcements.unpinnedToast });
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (a: Announcement) => deleteAnnouncement(a.id, a.version),
    onSuccess: async () => {
      setConfirming(null);
      await invalidate();
      toast.show({ message: copy.announcements.deleted });
    },
    onError: async (err) => {
      setConfirming(null);
      await fail(err);
    },
  });

  if (!access || session.status !== 'signedIn') return null;
  const userId = session.user.id;
  const blocked = access.writeBlockedReason;
  const open = (item?: Announcement) => setSheet({ item, key: Date.now() });
  const items = list.data ?? [];

  let body;
  if (list.isPending || dir.isPending) body = <SkeletonList rows={3} />;
  else if (list.isError) body = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else if (items.length === 0)
    body = (
      <EmptyState
        title={copy.announcements.emptyTitle}
        body={copy.announcements.emptyBody}
        action={
          <Button disabled={!!blocked} disabledReason={blocked ?? undefined} showReason onClick={() => open()}>
            {copy.announcements.post}
          </Button>
        }
      />
    );
  else
    body = (
      <ul aria-label={copy.announcements.title} className="flex flex-col gap-3">
        {items.map((a) => {
          const canChange = access.isAdmin || a.createdBy === userId;
          const why = blocked ?? (canChange ? undefined : copy.announcements.noPermission);
          return (
            <li key={a.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-ink-strong">{a.title}</h2>
                {a.pinnedAt ? <Chip tone="brand">{copy.announcements.pinned}</Chip> : null}
              </div>
              <p className="mt-1 text-sm text-ink2">
                {copy.announcements.by(dir.nameOfUser(a.createdBy), formatDateTime(a.createdAt))}
                {a.version > 1 ? ` · ${copy.announcements.edited}` : ''}
              </p>
              <p className="mt-3 text-base whitespace-pre-wrap text-ink">{a.body}</p>
              <div className="mt-2 -mr-2 -mb-1 flex justify-end gap-1">
                <IconButton label={copy.announcements.edit} icon={<Icon name="pen" size={20} />} disabled={!!why} disabledReason={why} onClick={() => open(a)} className="text-coral" />
                {access.isAdmin ? (
                  <IconButton
                    label={a.pinnedAt ? copy.announcements.unpin : copy.announcements.pin}
                    icon={<Icon name="pin" size={20} />}
                    aria-pressed={!!a.pinnedAt}
                    disabled={!!blocked || (pin.isPending && pin.variables?.id === a.id)}
                    disabledReason={blocked ?? undefined}
                    onClick={() => pin.mutate(a)}
                    className="text-coral"
                  />
                ) : null}
                <IconButton label={copy.announcements.delete} icon={<Icon name="trash" size={20} />} disabled={!!why} disabledReason={why} onClick={() => setConfirming(a)} className="text-coral" />
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <SubPage title={copy.announcements.title} backTo="/house">
      {body}
      <Fab onClick={() => open()} label={copy.announcements.post} disabledReason={blocked ?? undefined} />
      {sheet ? <AnnouncementSheet key={sheet.key} item={sheet.item} householdId={access.householdId} userId={userId} blockedReason={blocked} onClose={() => setSheet(null)} onConflict={onConflict} /> : null}
      <ConfirmDialog
        open={confirming !== null}
        title={copy.announcements.deleteTitle}
        confirmLabel={copy.announcements.deleteConfirm}
        cancelLabel={copy.announcements.deleteKeep}
        destructive
        loading={remove.isPending}
        onConfirm={() => confirming && remove.mutate(confirming)}
        onCancel={() => setConfirming(null)}
      >
        {copy.announcements.deleteBody}
      </ConfirmDialog>
    </SubPage>
  );
}
