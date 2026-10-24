import { useId, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'disabled'> {
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  /** Why the field is disabled. Announced, and shown on screen. */
  disabledReason?: string;
  id?: string;
}

/**
 * Native select (best mobile behaviour and accessibility). A disabled field stays focusable via
 * aria-disabled, keeps its value, and says why on screen.
 */
export function SelectField({ label, options, hint, error, disabled = false, disabledReason, id, className = '', onChange, ...rest }: SelectFieldProps) {
  const auto = useId();
  const selectId = id ?? auto;
  const reasonId = `${selectId}-reason`;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy =
    [hint ? hintId : null, disabled && disabledReason ? reasonId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-bold text-ink">
        {label}
      </label>
      <select
        {...rest}
        id={selectId}
        aria-disabled={disabled || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          if (disabled) return;
          onChange?.(e);
        }}
        // aria-disabled alone doesn't stop a native select opening, so block the interaction too.
        onMouseDown={(e) => disabled && e.preventDefault()}
        onKeyDown={(e) => disabled && e.key !== 'Tab' && e.preventDefault()}
        className={`min-h-12 w-full rounded-[var(--radius-control)] border bg-field px-4 py-2.5 text-base text-ink ${error ? 'border-danger' : 'border-field-line'} ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} className="text-sm text-ink2">
          {hint}
        </p>
      ) : null}
      {disabled && disabledReason ? (
        <p id={reasonId} className="text-sm font-semibold text-ink2">
          {disabledReason}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
