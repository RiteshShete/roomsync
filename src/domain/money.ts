/** Money helpers. Integer minor units only; never use floats for stored amounts. */

/** Max amount: 1e8 major units. */
export const MAX_MAJOR_UNITS = 100_000_000;

export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Parse user text such as "1,000.50" into minor units. Returns null when invalid,
 * non-positive, has too many decimals, or exceeds the maximum. Pure string math, no floats.
 */
export function parseAmount(input: string, digits = 2): number | null {
  const cleaned = input.trim().replace(/[,\s]/g, '');
  const m = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!m) return null;
  const whole = m[1]!;
  const frac = m[2] ?? '';
  if (frac.length > digits) return null;
  if (whole.length > 9) return null;
  const minor = Number(whole) * 10 ** digits + Number(frac.padEnd(digits, '0') || '0');
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  if (minor > MAX_MAJOR_UNITS * 10 ** digits) return null;
  return minor;
}

/** Minor units -> plain editable text, e.g. 100050 -> "1000.50". */
export function minorToInput(minor: number, digits = 2): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  if (digits === 0) return `${sign}${abs}`;
  const base = 10 ** digits;
  const whole = Math.floor(abs / base);
  const frac = String(abs % base).padStart(digits, '0');
  return `${sign}${whole}.${frac}`;
}

/** Display formatting, e.g. formatMoney(100050, 'INR') -> "₹1,000.50". */
export function formatMoney(minor: number, currency: string, locale?: string): string {
  const digits = currencyDigits(currency);
  const major = Number(minorToInput(minor, digits)); // display only
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(major);
}
