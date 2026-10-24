import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { copy } from '@/copy';
import { Icon } from './Icon';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** e.g. { label: 'Undo', onClick } for reversible actions. */
  action?: { label: string; onClick: () => void };
  /** Defaults: success 4s, info 5s, error 7s, any toast with an action 8s. */
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

interface ToastApi {
  show: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE = {
  success: { icon: 'check', cls: 'border-success bg-success-soft text-ink' },
  error: { icon: 'alert', cls: 'border-danger bg-danger-soft text-ink' },
  info: { icon: 'bell', cls: 'border-info bg-info-soft text-ink' },
} as const;

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const duration = toast.durationMs ?? (toast.action ? 8000 : toast.tone === 'error' ? 7000 : toast.tone === 'info' ? 5000 : 4000);

  useEffect(() => {
    const t = setTimeout(() => dismiss.current(), duration);
    return () => clearTimeout(t);
  }, [duration]);

  const tone = TONE[toast.tone];
  return (
    // Errors use role="alert" (assertive); the rest sit in the polite live region.
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border-2 px-4 py-3 shadow-lg ${tone.cls}`}
    >
      <Icon name={tone.icon} size={20} />
      <p className="flex-1 text-sm font-semibold">{toast.message}</p>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
          className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-extrabold text-primary hover:bg-brand-soft"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={copy.header.dismiss}
        onClick={onDismiss}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink2 hover:bg-brand-soft"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { ...input, id, tone: input.tone ?? 'success' }]);
    return id;
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
