import { useEffect, useId, useState } from 'react';
import { copy } from '@/copy';
import { currencyDigits, minorToInput, parseAmount } from '@/domain';
import { Icon } from './Icon';

export interface AmountInputProps {
  label: string;
  /** ISO 4217 code, e.g. "INR". Shown next to the field. */
  currency: string;
  /** Amount in integer minor units (paise/cents), or null when empty/invalid. */
  valueMinor: number | null;
  onChange: (minor: number | null, raw: string) => void;
  hint?: string;
  /** External error (e.g. from the server). A format error is shown automatically for invalid text. */
  error?: string | null;
  required?: boolean;
  id?: string;
}

function symbolFor(currency: string): string {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: 'currency', currency })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/**
 * Money entry. Text goes through `parseAmount` (no floats) and the parent receives integer minor
 * units. The raw text is kept locally so typing "1." or "1,2" is never rewritten under the user.
 */
export function AmountInput({ label, currency, valueMinor, onChange, hint, error, required, id }: AmountInputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const digits = currencyDigits(currency);
  const [raw, setRaw] = useState(() => (valueMinor === null ? '' : minorToInput(valueMinor, digits)));

  // Follow external resets (e.g. the parent clears the form) without fighting in-progress typing.
  useEffect(() => {
    if (valueMinor !== parseAmount(raw, digits)) {
      setRaw(valueMinor === null ? '' : minorToInput(valueMinor, digits));
    }
  }, [valueMinor]);

  const formatError = raw.trim() !== '' && parseAmount(raw, digits) === null ? copy.validation.amountInvalid : null;
  const shown = error ?? formatError;
  const describedBy = [hint ? `${inputId}-hint` : null, shown ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold text-ink">
        {label} <span className="font-normal text-ink2">({currency})</span>
      </label>
      <div
        className={`flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] border bg-field px-4 ${shown ? 'border-danger' : 'border-field-line'} focus-within:outline-3 focus-within:outline-[var(--focus)]`}
      >
        <span aria-hidden="true" className="text-lg font-bold text-ink2">
          {symbolFor(currency)}
        </span>
        <input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          required={required}
          value={raw}
          placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
          aria-invalid={shown ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const next = e.target.value;
            setRaw(next);
            onChange(parseAmount(next, digits), next);
          }}
          className="min-h-11 w-full bg-transparent text-xl font-bold text-ink outline-none placeholder:text-ink2/60"
        />
      </div>
      {hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-ink2">
          {hint}
        </p>
      ) : null}
      {shown ? (
        <p id={`${inputId}-error`} role="alert" className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>{shown}</span>
        </p>
      ) : null}
    </div>
  );
}
