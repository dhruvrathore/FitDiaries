/** Formatting helpers shared across screens. */

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Duration from milliseconds, e.g. 47m → "47m", 68m → "1h 08m". */
export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Compact volume, e.g. 12,450 → "12.5k". */
export function compactNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

export function kg(n: number | null | undefined): string {
  if (n == null) return '–';
  return Number.isInteger(n) ? `${n}` : `${n}`;
}

/** "45×10" style set summary. */
export function setLabel(weight: number | null, reps: number | null): string {
  if (weight == null && reps == null) return '–';
  if (weight == null) return `${reps ?? '–'}`;
  return `${weight}×${reps ?? '–'}`;
}
