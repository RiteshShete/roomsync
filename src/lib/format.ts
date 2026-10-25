/** Locale-aware date/time for display. Inputs are ISO strings from the database. */
export function formatDateTime(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** "2026-06-06" -> "06 Jun 2026". Date-only strings are built as local dates so the day never shifts. */
export function formatDay(isoDate: string, locale?: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y!, m! - 1, d));
}
