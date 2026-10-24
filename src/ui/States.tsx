import type { ReactNode } from 'react';
import { copy } from '@/copy';
import { Button } from './Button';
import { BrandMark } from './Icon';

/** Faded speech-bubble mark used on empty screens (as in the mockups). Decorative. */
function BubbleMark() {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-24 w-32 items-center justify-center rounded-[2.5rem] bg-brand-soft"
    >
      <span className="opacity-60">
        <BrandMark size={44} />
      </span>
    </span>
  );
}

/** Empty state: what is missing, what to do next, and a single call to action when one exists. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <BubbleMark />
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {body ? <p className="max-w-xs text-base text-ink2">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Error with a retry. The message is announced to assistive tech. */
export function ErrorState({
  title = copy.states.errorTitle,
  message,
  onRetry,
  retryLabel = copy.states.retry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="max-w-xs text-base text-ink2">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Single shimmering block. Hidden from assistive tech; wrap lists in <SkeletonList> to announce loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-xl bg-sunken motion-safe:animate-pulse ${className}`} />;
}

/** Placeholder rows that announce a single "Loading…" status. */
export function SkeletonList({ rows = 3, label = copy.states.loading }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3 p-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
