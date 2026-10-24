import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvite, revokeInvite, type CreatedInvite, type Invite } from '@/api/invites';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { SubPage } from '@/features/shell/SubPage';
import { FormError } from '@/features/auth/AuthLayout';
import { Button, Chip, ConfirmDialog, EmptyState, ErrorState, SelectField, Sheet, SkeletonList, useToast } from '@/ui';
import { InviteCodePanel } from './InviteCodePanel';
import { useHouseholdAccess, useInvites } from './useMembership';

function isPending(i: Invite, now = Date.now()): boolean {
  return i.status === 'active' && new Date(i.expiresAt).getTime() > now && (i.maxUses === null || i.useCount < i.maxUses);
}

/** Owner/admin: create invite codes, see pending ones, cancel them. Plain members get an explanation. */
export function InvitesScreen() {
  const access = useHouseholdAccess();
  const invites = useInvites(access?.householdId, access?.isAdmin ?? false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [expiry, setExpiry] = useState('168');
  const [uses, setUses] = useState('any');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Invite | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createInvite(access!.householdId, { expiresInHours: Number(expiry), maxUses: uses === 'any' ? null : Number(uses) }),
    onSuccess: async (invite) => {
      setCreated(invite);
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (err) => setCreateError(errorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: (i: Invite) => revokeInvite(i.id),
    onSuccess: async () => {
      setRevoking(null);
      await queryClient.invalidateQueries({ queryKey: ['invites'] });
      toast.show({ message: copy.invites.revoked });
    },
    onError: (err) => {
      setRevoking(null);
      toast.show({ tone: 'error', message: errorMessage(err) });
    },
  });

  function openSheet() {
    setCreated(null);
    setCreateError(null);
    setSheetOpen(true);
  }

  if (!access) return null;

  if (!access.isAdmin) {
    return (
      <SubPage title={copy.invites.title}>
        <EmptyState title={copy.invites.title} body={copy.invites.adminsOnly} />
      </SubPage>
    );
  }

  const pending = (invites.data ?? []).filter((i) => isPending(i));

  let list;
  if (invites.isPending) list = <SkeletonList rows={2} />;
  else if (invites.isError) list = <ErrorState message={errorMessage(invites.error)} onRetry={() => void invites.refetch()} />;
  else if (pending.length === 0) list = <EmptyState title={copy.invites.pendingNone} body={copy.invites.pendingNoneBody} />;
  else
    list = (
      <ul className="flex flex-col gap-3">
        {pending.map((i) => (
          <li key={i.id} className="flex flex-col gap-2 rounded-3xl border-2 border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-lg font-extrabold text-ink">••••••{i.codeHint}</p>
              <Chip tone={i.useCount === 0 ? 'warning' : 'success'}>{i.useCount === 0 ? 'Pending' : copy.invites.usedState(i.useCount)}</Chip>
            </div>
            <p className="text-sm text-ink2">{copy.invites.hint(i.codeHint)}</p>
            <p className="text-sm text-ink2">
              {copy.invites.expiresOn(formatDateTime(i.expiresAt))}
              {i.maxUses !== null ? ` · ${copy.invites.limit(i.maxUses)}` : ''}
            </p>
            {i.useCount === 0 ? <p className="text-sm font-semibold text-ink">{copy.invites.pendingState}</p> : null}
            <Button variant="secondary" disabled={!!access.writeBlockedReason} disabledReason={access.writeBlockedReason ?? undefined} showReason onClick={() => setRevoking(i)}>
              {copy.invites.revoke}
            </Button>
          </li>
        ))}
      </ul>
    );

  return (
    <SubPage title={copy.invites.title}>
      <Button fullWidth disabled={!!access.writeBlockedReason} disabledReason={access.writeBlockedReason ?? undefined} showReason onClick={openSheet}>
        {pending.length > 0 ? copy.invites.createAnother : copy.invites.create}
      </Button>
      <h2 className="text-lg font-extrabold text-ink">{copy.invites.pendingTitle}</h2>
      {list}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={copy.invites.sheetTitle} footer={created ? <Button fullWidth onClick={() => setSheetOpen(false)}>{copy.invites.close}</Button> : undefined}>
        {created ? (
          <InviteCodePanel code={created.code} expiresAt={created.expiresAt} />
        ) : (
          <form
            className="flex flex-col gap-4 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!createMutation.isPending) createMutation.mutate();
            }}
          >
            <SelectField label={copy.invites.expiry} options={[...copy.invites.expiryOptions]} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            <SelectField label={copy.invites.uses} options={[...copy.invites.usesOptions]} value={uses} onChange={(e) => setUses(e.target.value)} />
            <FormError message={createError} />
            <Button type="submit" fullWidth loading={createMutation.isPending} loadingLabel={copy.invites.creating}>
              {copy.invites.create}
            </Button>
          </form>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!revoking}
        title={copy.invites.revokeTitle}
        confirmLabel={copy.invites.revokeConfirm}
        cancelLabel={copy.invites.keep}
        destructive
        loading={revokeMutation.isPending}
        onCancel={() => setRevoking(null)}
        onConfirm={() => revoking && revokeMutation.mutate(revoking)}
      >
        {copy.invites.revokeBody}
      </ConfirmDialog>
    </SubPage>
  );
}
