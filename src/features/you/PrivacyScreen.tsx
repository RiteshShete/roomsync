import { useState } from 'react';
import { exportMyHouseholdData } from '@/api/profile';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { downloadJson } from '@/lib/download';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { SubPage } from '@/features/shell/SubPage';
import { Button, FormError, useToast } from '@/ui';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <h2 id={id} className="text-lg font-bold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** You → Privacy, help and your data: what is stored, what is not done, export, help, and honest delete-account steps. */
export function PrivacyScreen() {
  const access = useHouseholdAccess();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    if (!access || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await exportMyHouseholdData(access.householdId);
      downloadJson(`roomsync-${new Date().toISOString().slice(0, 10)}.json`, data);
      toast.show({ message: copy.privacy.exported });
    } catch (err) {
      setError(`${copy.privacy.exportFailed} ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubPage title={copy.privacy.title}>
      <Section id="priv-stores" title={copy.privacy.storesTitle}>
        <p className="text-base text-ink">{copy.privacy.stores}</p>
      </Section>
      <Section id="priv-not" title={copy.privacy.notTitle}>
        <p className="text-base text-ink">{copy.privacy.not}</p>
      </Section>
      <Section id="priv-export" title={copy.privacy.exportTitle}>
        <p className="text-base text-ink">{copy.privacy.exportBody}</p>
        <FormError message={error} />
        <Button variant="secondary" loading={busy} loadingLabel={copy.privacy.exporting} onClick={() => void onExport()}>
          {copy.privacy.exportButton}
        </Button>
      </Section>
      <Section id="priv-help" title={copy.privacy.helpTitle}>
        <ul className="list-disc space-y-1 pl-5 text-base text-ink">
          {copy.privacy.help.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Section>
      <Section id="priv-delete" title={copy.privacy.deleteTitle}>
        <p className="text-base text-ink">{copy.privacy.deleteBody}</p>
      </Section>
    </SubPage>
  );
}
