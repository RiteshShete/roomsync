import { useId } from 'react';

export interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Switch with a visible label. State is conveyed by role="switch" + aria-checked and by the
 * knob position, never by colour alone. 44px tall hit area.
 */
export function Toggle({ label, description, checked, onChange, disabled = false, disabledReason }: ToggleProps) {
  const id = useId();
  const descId = `${id}-desc`;
  const reasonId = `${id}-reason`;
  const describedBy = [description ? descId : null, disabled && disabledReason ? reasonId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-12 items-center justify-between gap-4">
        <span id={id} className="text-base font-bold text-ink">
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={id}
          aria-describedby={describedBy}
          aria-disabled={disabled || undefined}
          onClick={() => !disabled && onChange(!checked)}
          className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors ${checked ? 'border-primary bg-primary' : 'border-line bg-sunken'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-all ${checked ? 'left-[1.625rem]' : 'left-0.5'}`}
          />
        </button>
      </div>
      {description ? (
        <p id={descId} className="text-sm text-ink2">
          {description}
        </p>
      ) : null}
      {disabled && disabledReason ? (
        <p id={reasonId} className="text-sm font-semibold text-ink2">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
