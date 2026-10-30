/** The label for a day relative to `now`: Today, Yesterday, or a short date. Local calendar days. */
export function dayLabel(iso: string, now: Date = new Date(), locale?: string): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Consecutive events under one day label; the input is already newest first, so order is kept. */
export function groupByDay<T extends { createdAt: string }>(events: T[], now: Date = new Date(), locale?: string): { label: string; events: T[] }[] {
  const groups: { label: string; events: T[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.createdAt, now, locale);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(e);
    else groups.push({ label, events: [e] });
  }
  return groups;
}
