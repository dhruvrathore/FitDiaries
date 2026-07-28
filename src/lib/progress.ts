import type { ExerciseSetRow } from '@/db/queries';
import { prEvents, type PREvent, type PRType } from './metrics';
import { mondayOf, toISODate } from './week';

export type NamedPREvent = PREvent & { exerciseId: number; exerciseName: string };

/** All PR events across every exercise, newest first. */
export function computeAllPREvents(rows: ExerciseSetRow[]): NamedPREvent[] {
  const byExercise = new Map<number, { name: string; sets: ExerciseSetRow[] }>();
  for (const r of rows) {
    let entry = byExercise.get(r.exerciseId);
    if (!entry) {
      entry = { name: r.exerciseName, sets: [] };
      byExercise.set(r.exerciseId, entry);
    }
    entry.sets.push(r);
  }
  const out: NamedPREvent[] = [];
  for (const [exerciseId, { name, sets }] of byExercise) {
    for (const ev of prEvents(sets.map((s) => ({ weight: s.weight, reps: s.reps, at: s.at })))) {
      out.push({ ...ev, exerciseId, exerciseName: name });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

export function prEventsInRange(
  events: NamedPREvent[],
  startMs: number,
  endMs: number
): NamedPREvent[] {
  return events.filter((e) => e.at >= startMs && e.at < endMs);
}

/** Weekly volume totals, oldest→newest, for the last `weeks` weeks. */
export function weeklyVolumeSeries(
  sets: { weight: number | null; reps: number | null; at: number }[],
  weeks: number,
  now: Date = new Date()
): { weekISO: string; volume: number }[] {
  const buckets = new Map<string, number>();
  for (const s of sets) {
    const iso = toISODate(mondayOf(new Date(s.at)));
    const v = (s.weight ?? 0) * (s.reps ?? 0);
    buckets.set(iso, (buckets.get(iso) ?? 0) + v);
  }
  const series: { weekISO: string; volume: number }[] = [];
  const thisMonday = mondayOf(now);
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const iso = toISODate(d);
    series.push({ weekISO: iso, volume: buckets.get(iso) ?? 0 });
  }
  return series;
}

export type ExerciseProgression = {
  exerciseId: number;
  name: string;
  points: { at: number; oneRm: number; topWeight: number }[];
};

/** Best est-1RM and top weight per session, per exercise (for progression lines). */
export function exerciseProgressions(rows: ExerciseSetRow[]): ExerciseProgression[] {
  const byExercise = new Map<number, { name: string; sessions: Map<number, ExerciseSetRow[]> }>();
  for (const r of rows) {
    if (r.weight == null || r.reps == null || r.reps <= 0) continue;
    let entry = byExercise.get(r.exerciseId);
    if (!entry) {
      entry = { name: r.exerciseName, sessions: new Map() };
      byExercise.set(r.exerciseId, entry);
    }
    const arr = entry.sessions.get(r.at) ?? [];
    arr.push(r);
    entry.sessions.set(r.at, arr);
  }
  const out: ExerciseProgression[] = [];
  for (const [exerciseId, { name, sessions }] of byExercise) {
    const points = Array.from(sessions.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([at, sets]) => {
        let oneRm = 0;
        let topWeight = 0;
        for (const s of sets) {
          const w = s.weight!;
          const rm = w * (1 + s.reps! / 30);
          if (rm > oneRm) oneRm = rm;
          if (w > topWeight) topWeight = w;
        }
        return { at, oneRm: Math.round(oneRm * 10) / 10, topWeight };
      });
    if (points.length > 0) out.push({ exerciseId, name, points });
  }
  return out.sort((a, b) => b.points.length - a.points.length);
}

export const PR_EMOJI: Record<PRType, string> = {
  heaviest: '🏋️',
  oneRm: '📈',
  repsAtWeight: '🔁',
};
