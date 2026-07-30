/**
 * Body-overview math: maps the app's fine-grained muscle groups (see db/seed.ts)
 * onto the six drawn body parts, and turns this week's per-muscle set counts into
 * a growth level (0..3) per part. Pure — no DB / React imports.
 */

export type PartKey = 'chest' | 'back' | 'shoulders' | 'neck' | 'arms' | 'abs' | 'legs';

export type PartDef = {
  key: PartKey;
  label: string;
  /** Muscle-group names (from seed.ts) that feed this part. */
  muscles: string[];
  /** Working sets/week that count as a fully-developed part (level 3). */
  target: number;
};

/** Display order matches the body overview list. */
export const PARTS: PartDef[] = [
  { key: 'chest', label: 'Chest', muscles: ['Chest'], target: 12 },
  { key: 'back', label: 'Back', muscles: ['Back / Lats', 'Lower back'], target: 14 },
  {
    key: 'shoulders',
    label: 'Shoulders',
    muscles: ['Front delts', 'Side delts', 'Rear delts'],
    target: 12,
  },
  { key: 'neck', label: 'Neck & traps', muscles: ['Traps', 'Neck'], target: 8 },
  { key: 'arms', label: 'Arms', muscles: ['Biceps', 'Triceps', 'Forearms', 'Grip'], target: 12 },
  { key: 'abs', label: 'Abs', muscles: ['Core'], target: 8 },
  {
    key: 'legs',
    label: 'Legs',
    muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'],
    target: 16,
  },
];

export type PartLevel = 0 | 1 | 2 | 3;

export type PartProgress = {
  sets: number;
  target: number;
  /** min(1, sets / target). */
  pct: number;
  level: PartLevel;
};

/** Growth level for a completion ratio: 0 flat, 1 started, 2 developing, 3 developed. */
export function levelFor(pct: number): PartLevel {
  if (pct <= 0) return 0;
  if (pct < 0.4) return 1;
  if (pct < 0.75) return 2;
  return 3;
}

/**
 * Roll this week's per-muscle set counts up into the six body parts, with a
 * completion ratio and growth level for each.
 */
export function partProgress(setsByMuscle: Record<string, number>): Record<PartKey, PartProgress> {
  const out = {} as Record<PartKey, PartProgress>;
  for (const part of PARTS) {
    const sets = part.muscles.reduce((sum, m) => sum + (setsByMuscle[m] ?? 0), 0);
    const pct = Math.min(1, part.target > 0 ? sets / part.target : 0);
    out[part.key] = { sets, target: part.target, pct, level: levelFor(pct) };
  }
  return out;
}

/** Convenience: just the level per part (what BodyAvatar consumes). */
export function partLevels(progress: Record<PartKey, PartProgress>): Record<PartKey, PartLevel> {
  const out = {} as Record<PartKey, PartLevel>;
  for (const part of PARTS) out[part.key] = progress[part.key].level;
  return out;
}
