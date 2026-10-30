/** Locale-aware date/time for display. Inputs are ISO strings from the database. */
export function formatDateTime(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** "2026-06-06" -> "06 Jun 2026". Date-only strings are built as local dates so the day never shifts. */
export function formatDay(isoDate: string, locale?: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y!, m! - 1, d));
}

/** "5 mins ago", "2 hours ago"; older than a day falls back to the short date. `now` is injectable for tests. */
export function formatRelative(iso: string, now: Date = new Date(), locale?: string): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(iso));
}
