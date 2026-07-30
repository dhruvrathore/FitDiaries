/**
 * Pure workout math: volume, estimated 1RM, and the three PR types.
 * No DB / React imports — screens assemble plain arrays and call these.
 */

export type SetLite = { weight: number | null; reps: number | null };
export type TimedSet = SetLite & { at: number };

export type PRType = 'heaviest' | 'oneRm' | 'repsAtWeight';

export const PR_LABEL: Record<PRType, string> = {
  heaviest: 'Heaviest weight',
  oneRm: 'Best est. 1RM',
  repsAtWeight: 'Most reps @ weight',
};

const EPS = 1e-9;

function isCounted(s: SetLite): s is { weight: number; reps: number } {
  return s.weight != null && s.reps != null && s.reps > 0;
}

/** Epley estimated one-rep max. */
export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function setVolume(s: SetLite): number {
  return (s.weight ?? 0) * (s.reps ?? 0);
}

export function totalVolume(sets: SetLite[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0);
}

/** volume grouped by (primary) muscle name. */
export function volumeByMuscle(
  entries: { weight: number | null; reps: number | null; muscle: string }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const v = setVolume(e);
    if (v <= 0) continue;
    out[e.muscle] = (out[e.muscle] ?? 0) + v;
  }
  return out;
}

/** Count of completed working sets (reps logged) grouped by (primary) muscle name. */
export function setsByMuscle(
  entries: { reps: number | null; muscle: string }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.reps == null) continue;
    out[e.muscle] = (out[e.muscle] ?? 0) + 1;
  }
  return out;
}

export type PRFlags = { heaviest: boolean; oneRm: boolean; repsAtWeight: boolean };

export function anyPR(f: PRFlags): boolean {
  return f.heaviest || f.oneRm || f.repsAtWeight;
}

/**
 * Which PR type(s) `cand` sets against prior history for the SAME exercise.
 * A first-ever set is a baseline, not a "beaten" record, so it flags nothing.
 */
export function detectPRs(history: SetLite[], cand: SetLite): PRFlags {
  const flags: PRFlags = { heaviest: false, oneRm: false, repsAtWeight: false };
  if (!isCounted(cand)) return flags;
  const prior = history.filter(isCounted);
  if (prior.length === 0) return flags;

  const maxW = Math.max(...prior.map((s) => s.weight));
  const maxRm = Math.max(...prior.map((s) => epley1RM(s.weight, s.reps)));
  const repsAtSameWeight = prior.filter((s) => s.weight === cand.weight).map((s) => s.reps);

  flags.heaviest = cand.weight > maxW + EPS;
  flags.oneRm = epley1RM(cand.weight, cand.reps) > maxRm + EPS;
  flags.repsAtWeight =
    repsAtSameWeight.length > 0 && cand.reps > Math.max(...repsAtSameWeight);
  return flags;
}

export type PREvent = {
  type: PRType;
  at: number;
  weight: number;
  reps: number;
  value: number; // weight (heaviest), est-1RM (oneRm), or reps (repsAtWeight)
};

/**
 * Chronological PR events for one exercise's full history — used for the PR log
 * and "PRs this week". Same beaten-record semantics as detectPRs.
 */
export function prEvents(sets: TimedSet[]): PREvent[] {
  const sorted = sets.filter(isCounted).sort((a, b) => a.at - b.at) as (TimedSet & {
    weight: number;
    reps: number;
  })[];

  let maxW = -Infinity;
  let maxRm = -Infinity;
  const bestRepsAt = new Map<number, number>();
  const events: PREvent[] = [];
  let seen = false;

  for (const s of sorted) {
    if (seen) {
      if (s.weight > maxW + EPS) {
        events.push({ type: 'heaviest', at: s.at, weight: s.weight, reps: s.reps, value: s.weight });
      }
      const rm = epley1RM(s.weight, s.reps);
      if (rm > maxRm + EPS) {
        events.push({ type: 'oneRm', at: s.at, weight: s.weight, reps: s.reps, value: rm });
      }
      const prev = bestRepsAt.get(s.weight);
      if (prev != null && s.reps > prev) {
        events.push({ type: 'repsAtWeight', at: s.at, weight: s.weight, reps: s.reps, value: s.reps });
      }
    }
    maxW = Math.max(maxW, s.weight);
    maxRm = Math.max(maxRm, epley1RM(s.weight, s.reps));
    bestRepsAt.set(s.weight, Math.max(bestRepsAt.get(s.weight) ?? 0, s.reps));
    seen = true;
  }
  return events;
}

/** All-time records for one exercise, for the exercise/progress detail. */
export function currentRecords(sets: SetLite[]): {
  heaviest: number | null;
  bestOneRm: number | null;
  bestOneRmAt: { weight: number; reps: number } | null;
} {
  const counted = sets.filter(isCounted);
  if (counted.length === 0) return { heaviest: null, bestOneRm: null, bestOneRmAt: null };
  let heaviest = -Infinity;
  let bestOneRm = -Infinity;
  let bestAt: { weight: number; reps: number } | null = null;
  for (const s of counted) {
    heaviest = Math.max(heaviest, s.weight);
    const rm = epley1RM(s.weight, s.reps);
    if (rm > bestOneRm) {
      bestOneRm = rm;
      bestAt = { weight: s.weight, reps: s.reps };
    }
  }
  return { heaviest, bestOneRm, bestOneRmAt: bestAt };
}
