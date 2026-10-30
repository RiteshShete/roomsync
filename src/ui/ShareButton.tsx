import { copy } from '@/copy';
import { shareText } from '@/lib/share';
import { Icon } from './Icon';
import { useToast } from './Toast';

/** The share icon in a tab page's header (a 34 px white tile, as designed, inside a 44 px touch target): shares or copies the text `build` returns. */
export function ShareButton({ label, title, build }: { label: string; title: string; build: () => string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        const result = await shareText(title, build());
        if (result === 'copied') toast.show({ message: copy.share.copied });
        else if (result === 'failed') toast.show({ tone: 'error', message: copy.share.failed });
      }}
      className="-mr-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
    >
      <span aria-hidden="true" className="flex h-[34px] w-[34px] items-center justify-center rounded bg-surface text-primary shadow-[0_0_3px_rgba(0,0,0,0.11)]">
        <Icon name="share" size={22} />
      </span>
    </button>
  );
}
