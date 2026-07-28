/**
 * Week + deload-cycle helpers. Weeks run Monday→Sunday in LOCAL time.
 * ISO date strings are `YYYY-MM-DD` (local calendar day, no timezone).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday (local midnight) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday..Sunday range as epoch-ms bounds: [startMs, endMs) for `startedAt` queries. */
export function weekRange(d: Date): { start: Date; end: Date; startMs: number; endMs: number } {
  const start = mondayOf(d);
  const end = new Date(start.getTime() + WEEK_MS);
  return { start, end, startMs: start.getTime(), endMs: end.getTime() };
}

export function addWeeks(d: Date, n: number): Date {
  return new Date(mondayOf(d).getTime() + n * WEEK_MS);
}

/** Whole weeks from cycle-start Monday to the Monday of `d` (can be negative). */
export function weeksSinceCycleStart(d: Date, cycleStartISO: string): number {
  const startMon = mondayOf(fromISODate(cycleStartISO));
  const curMon = mondayOf(d);
  return Math.floor((curMon.getTime() - startMon.getTime()) / WEEK_MS);
}

/** 1-based position (1..4) of `d` within its 4-week deload block. */
export function deloadWeekIndex(d: Date, cycleStartISO: string): number {
  const weeks = weeksSinceCycleStart(d, cycleStartISO);
  return (((weeks % 4) + 4) % 4) + 1;
}

/** Every 4th week (position 4 in the block) is a deload week. */
export function isDeloadWeek(d: Date, cycleStartISO: string): boolean {
  return deloadWeekIndex(d, cycleStartISO) === 4;
}

/** Short human label, e.g. "Mon 21 Jul". */
export function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "This week" / "Last week" for recent weeks, else null (caller falls back to weekLabel). */
export function relativeWeekLabel(monday: Date, now: Date): string | null {
  const diff = Math.round((mondayOf(now).getTime() - mondayOf(monday).getTime()) / WEEK_MS);
  return diff === 0 ? 'This week' : diff === 1 ? 'Last week' : null;
}

/** Week label, e.g. "21–27 Jul". */
export function weekLabel(d: Date): string {
  const { start, end } = weekRange(d);
  const last = new Date(end.getTime() - DAY_MS);
  const sameMonth = start.getMonth() === last.getMonth();
  const startStr = start.toLocaleDateString(undefined, {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
  });
  const endStr = last.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${startStr}–${endStr}`;
}
