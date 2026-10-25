import { useId, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  /** Message shown (and announced) when set. */
  error?: string | null;
  id?: string;
}

/** Labelled multi-line input, styled and announced like `Field`. */
export function TextArea({ label, hint, error, id, rows = 4, className = '', ...input }: TextAreaProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold text-ink">
        {label}
      </label>
      <textarea
        {...input}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full resize-y rounded-[var(--radius-control)] border bg-field px-4 py-2.5 text-base text-ink placeholder:text-ink3/70 focus-visible:outline-offset-0 ${error ? 'border-danger' : 'border-field-line'} ${className}`}
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
