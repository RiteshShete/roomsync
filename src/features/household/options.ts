import { copy } from '@/copy';

/** Currencies offered for a household. The database accepts any ISO-style 3-letter code. */
export const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian rupee (₹)' },
  { value: 'USD', label: 'USD — US dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — Pound sterling (£)' },
  { value: 'AED', label: 'AED — UAE dirham' },
  { value: 'AUD', label: 'AUD — Australian dollar' },
  { value: 'CAD', label: 'CAD — Canadian dollar' },
  { value: 'SGD', label: 'SGD — Singapore dollar' },
];

export const SPLIT_OPTIONS = [
  { value: 'equal', label: copy.settings.splits.equal! },
  { value: 'custom', label: copy.settings.splits.custom! },
  { value: 'percentage', label: copy.settings.splits.percentage! },
];

/** Keep the household's current currency selectable even if it is not in the short list above. */
export function currencyOptionsWith(current: string) {
  return CURRENCY_OPTIONS.some((o) => o.value === current)
    ? CURRENCY_OPTIONS
    : [{ value: current, label: current }, ...CURRENCY_OPTIONS];
}
