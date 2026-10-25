import { useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'amber';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant;
  /** Shows a busy state and blocks clicks. Keep `children` as the idle label; pass `loadingLabel` to change it. */
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  /** Why the control is disabled. Always announced; rendered visibly when `showReason` is set. */
  disabledReason?: string;
  showReason?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-pressed active:bg-primary-pressed border-transparent',
  secondary: 'bg-surface text-coral border-line hover:bg-brand-soft active:bg-brand-soft',
  tertiary: 'bg-transparent text-coral border-transparent hover:bg-brand-soft active:bg-brand-soft',
  danger: 'bg-danger text-white border-transparent hover:opacity-90 active:opacity-80',
  amber: 'rounded-full bg-amber text-on-amber border-transparent hover:bg-amber-pressed active:bg-amber-pressed',
};

/** Disabled is a flat neutral grey with readable text, never a faded version of the active colour. */
const DISABLED: Record<ButtonVariant, string> = {
  primary: 'bg-sunken text-ink2 border-line',
  secondary: 'bg-sunken text-ink2 border-line',
  tertiary: 'bg-transparent text-ink2 border-transparent',
  danger: 'bg-sunken text-ink2 border-line',
  amber: 'rounded-full bg-sunken text-ink2 border-line',
};

/**
 * Uses aria-disabled (not the disabled attribute) so a disabled control stays focusable and its
 * reason can be reached by keyboard and screen reader. Clicks are swallowed while inactive.
 */
export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel,
  disabled = false,
  disabledReason,
  showReason = false,
  fullWidth = false,
  icon,
  type = 'button',
  className = '',
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const reasonId = useId();
  const inactive = disabled || loading;
  const reason = disabled ? disabledReason : undefined;

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (inactive) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }

  return (
    <>
      <button
        {...rest}
        type={type}
        onClick={handleClick}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        aria-describedby={reason ? reasonId : rest['aria-describedby']}
        title={reason ?? rest.title}
        className={[
          'inline-flex min-h-11 items-center justify-center gap-2 border px-5 py-2.5',
          variant === 'amber' ? '' : 'rounded-[var(--radius-control)]',
          'text-base font-semibold transition-colors select-none',
          disabled ? DISABLED[variant] : VARIANTS[variant],
          fullWidth ? 'w-full' : '',
          disabled ? 'cursor-not-allowed' : loading ? 'cursor-wait' : 'cursor-pointer',
          className,
        ].join(' ')}
      >
        {loading ? (
          <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border border-current border-t-transparent motion-safe:animate-spin" />
        ) : (
          icon
        )}
        <span>{loading && loadingLabel ? loadingLabel : children}</span>
      </button>
      {reason ? (
        <span id={reasonId} className={showReason ? 'mt-1 block text-sm text-ink2' : 'sr-only'}>
          {reason}
        </span>
      ) : null}
    </>
  );
}

/** Icon-only button. `label` is required: it is the accessible name. */
export function IconButton({
  label,
  icon,
  disabled = false,
  disabledReason,
  className = '',
  onClick,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'children'> & {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const reasonId = useId();
  return (
    <>
      <button
        {...rest}
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        title={disabled && disabledReason ? disabledReason : label}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        className={[
          'inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-brand-soft',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className,
        ].join(' ')}
      >
        {icon}
      </button>
      {disabled && disabledReason ? (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}
    </>
  );
}
