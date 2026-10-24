/** Pure date helpers on ISO `YYYY-MM-DD` strings (UTC arithmetic, no time zones). */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.toISOString().slice(0, 10) === s;
}

function toUtc(s: string): Date {
  if (!isIsoDate(s)) throw new Error(`invalid date: ${s}`);
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(s: string, days: number): string {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Add months, clamping to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(s: string, months: number): string {
  const d = toUtc(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function isFuture(s: string, today: string): boolean {
  return s > today;
}

export function isOverdue(due: string | null, today: string): boolean {
  return due !== null && due < today;
}
