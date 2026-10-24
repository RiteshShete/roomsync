import { copy } from '@/copy';
import { formatInviteCode } from '@/domain';
import { copyText } from '@/lib/clipboard';
import { formatDateTime } from '@/lib/format';
import { Button, useToast } from '@/ui';

/**
 * Shows a freshly created invite code. It is displayed once (only a hash is stored), so the copy
 * button and the explanation matter. A clipboard failure never hides the code.
 */
export function InviteCodePanel({ code, expiresAt }: { code: string; expiresAt: string }) {
  const toast = useToast();
  const shown = formatInviteCode(code);

  async function onCopy() {
    const ok = await copyText(shown);
    toast.show(ok ? { message: copy.invites.copied } : { tone: 'error', message: copy.invites.copyFailed });
  }

  return (
    <section aria-labelledby="invite-code-title" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h3 id="invite-code-title" className="text-base font-bold text-ink">
        {copy.invites.codeTitle}
      </h3>
      <p aria-label={`Invite code ${shown.split('').join(' ')}`} data-testid="invite-code" className="rounded-xl bg-tint py-4 text-center font-mono text-3xl font-bold tracking-widest text-ink select-all">
        {shown}
      </p>
      <p className="text-sm text-ink2">{copy.invites.codeNote}</p>
      <p className="text-sm font-semibold text-ink">{copy.invites.expiresOn(formatDateTime(expiresAt))}</p>
      <Button variant="secondary" fullWidth onClick={onCopy}>
        {copy.invites.copy}
      </Button>
    </section>
  );
}
