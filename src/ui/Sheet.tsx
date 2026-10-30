import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { copy } from '@/copy';
import { Icon } from './Icon';

const FOCUSABLE =
  'a[href], button:not([aria-hidden="true"]), input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `bottom` is a mobile bottom sheet; `center` is a compact dialog (used for confirmations). */
  variant?: 'bottom' | 'center';
  /** Hide the close (×) button, e.g. when the dialog has its own Cancel. */
  hideClose?: boolean;
  /** Keep the title for screen readers only; the close button then floats at the top right (the design's item sheet). */
  hideTitle?: boolean;
  /** Extra classes for the footer bar, e.g. a tinted background. */
  footerClassName?: string;
}

/**
 * Modal dialog: traps focus, closes on Escape or backdrop click, locks page scroll, and restores
 * focus to the element that opened it. Put `data-autofocus` on the control that should start focused.
 */
export function Sheet({ open, onClose, title, children, footer, variant = 'bottom', hideClose = false, hideTitle = false, footerClassName = '' }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const items = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (node?.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0] ?? node)?.focus();
    const scrollLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = scrollLock;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const isBottom = variant === 'bottom';
  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${isBottom ? 'items-end' : 'items-center'} justify-center`}>
      <div className="absolute inset-0 bg-scrim" aria-hidden="true" onClick={() => onCloseRef.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'relative flex max-h-[90dvh] w-full max-w-md flex-col bg-surface shadow-xl outline-none',
          isBottom ? 'rounded-t-3xl pb-[env(safe-area-inset-bottom)]' : 'mx-4 rounded-3xl',
        ].join(' ')}
      >
        {isBottom ? <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" /> : null}
        <div className={hideTitle ? '' : 'flex items-start justify-between gap-2 px-5 pt-4'}>
          <h2 id={titleId} className={hideTitle ? 'sr-only' : 'text-xl font-bold text-ink'}>
            {title}
          </h2>
          {hideClose ? null : (
            <button
              type="button"
              aria-label={copy.header.close}
              onClick={() => onCloseRef.current()}
              className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink2 hover:bg-brand-soft ${hideTitle ? 'absolute top-3 right-3 z-10' : '-mr-2'}`}
            >
              <Icon name="close" size={22} />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-3">{children}</div>
        {footer ? <div className={`flex flex-col gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end ${footerClassName}`}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
