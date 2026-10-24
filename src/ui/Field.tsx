import { useId, useState, type InputHTMLAttributes } from 'react';
import { copy } from '@/copy';
import { Icon } from './Icon';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  /** Message shown (and announced) when set. */
  error?: string | null;
  optional?: boolean;
  id?: string;
}

const INPUT =
  'min-h-12 w-full rounded-[var(--radius-control)] border-2 bg-surface px-4 py-2.5 text-base text-ink ' +
  'placeholder:text-ink2/70 focus-visible:outline-offset-0';

/** Labelled text input with hint and error. Errors are `role="alert"` so they are announced. */
export function Field({ label, hint, error, optional, id, className = '', ...input }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold text-ink">
        {label}
        {optional ? <span className="font-normal text-ink2"> (optional)</span> : null}
      </label>
      <input
        {...input}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT} ${error ? 'border-danger' : 'border-line'} ${className}`}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-ink2">
          {hint}
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

/** Password input with a show/hide toggle (state also conveyed by the button label). */
export function PasswordField({ label, hint, error, id, className = '', ...input }: Omit<FieldProps, 'type' | 'optional'>) {
  const auto = useId();
  const inputId = id ?? auto;
  const [visible, setVisible] = useState(false);
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          {...input}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${INPUT} pr-14 ${error ? 'border-danger' : 'border-line'} ${className}`}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? copy.auth.hidePassword : copy.auth.showPassword}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink2 hover:bg-brand-soft"
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-ink2">
          {hint}
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
