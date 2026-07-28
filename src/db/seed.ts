import { db } from './client';
import {
  dayTemplates,
  exerciseMuscles,
  exercises,
  mobilityItems,
  muscleGroups,
  settings,
  templateExercises,
  templateMobility,
} from './schema';
import { mondayOf, toISODate } from '@/lib/week';
import { insertHistory } from './seedHistory';

// ---- Muscle groups ----------------------------------------------------------
const MUSCLES = [
  'Back / Lats',
  'Chest',
  'Front delts',
  'Side delts',
  'Rear delts',
  'Biceps',
  'Triceps',
  'Traps',
  'Neck',
  'Forearms',
  'Glutes',
  'Quads',
  'Hamstrings',
  'Calves',
  'Adductors',
  'Lower back',
  'Core',
  'Grip',
  'Cardio',
] as const;

// ---- Exercises: name -> [primary muscle, metric] ----------------------------
type Metric = 'weight_reps' | 'cardio';
const EXERCISES: Record<string, { muscle: string; metric?: Metric }> = {
  // Back
  'Lat pulldown': { muscle: 'Back / Lats' },
  'T-bar row': { muscle: 'Back / Lats' },
  'Barbell row': { muscle: 'Back / Lats' },
  'Single-arm row': { muscle: 'Back / Lats' },
  'Lat cable pressdown': { muscle: 'Back / Lats' },
  'Back extension': { muscle: 'Lower back' },
  'Rear-delt fly': { muscle: 'Rear delts' },
  'Face pulls': { muscle: 'Rear delts' },
  'Biceps single preacher': { muscle: 'Biceps' },
  'Biceps double preacher': { muscle: 'Biceps' },
  'Biceps curl (DB)': { muscle: 'Biceps' },
  // Chest
  'Incline DB press': { muscle: 'Chest' },
  'Bench press (barbell)': { muscle: 'Chest' },
  'Pec deck fly': { muscle: 'Chest' },
  'DB shoulder press': { muscle: 'Front delts' },
  'DB lateral raise': { muscle: 'Side delts' },
  'Triceps single-arm': { muscle: 'Triceps' },
  // Leg
  'Calf raise': { muscle: 'Calves' },
  'Hip thrust': { muscle: 'Glutes' },
  Squats: { muscle: 'Quads' },
  'Hamstring curl': { muscle: 'Hamstrings' },
  // Arms
  'Overhead DB extension': { muscle: 'Triceps' },
  'Cable biceps': { muscle: 'Biceps' },
  'Hammer curl': { muscle: 'Biceps' },
  'EZ barbell curl': { muscle: 'Biceps' },
  Shrugs: { muscle: 'Traps' },
  'Neck (front)': { muscle: 'Neck' },
  'Neck (back)': { muscle: 'Neck' },
  Forearms: { muscle: 'Forearms' },
  // Leg 2
  'Bulgarian split squat': { muscle: 'Quads' },
  'RDL (barbell)': { muscle: 'Hamstrings' },
  'Standing calf': { muscle: 'Calves' },
  Adductors: { muscle: 'Adductors' },
  'Wall ball': { muscle: 'Quads' },
  'Farmers walk': { muscle: 'Grip' },
  // Hyrox / cardio
  Run: { muscle: 'Cardio', metric: 'cardio' },
  Rowing: { muscle: 'Cardio', metric: 'cardio' },
  'Farmers carry': { muscle: 'Grip', metric: 'cardio' },
  'Hanging knee raise': { muscle: 'Core' },
};

// ---- Templates: name -> ordered exercise names ------------------------------
const TEMPLATES: { name: string; exercises: string[] }[] = [
  {
    name: 'Back day',
    exercises: [
      'Lat pulldown',
      'T-bar row',
      'Barbell row',
      'Single-arm row',
      'Back extension',
      'Lat cable pressdown',
      'Rear-delt fly',
      'Face pulls',
      'Biceps single preacher',
      'Biceps double preacher',
      'Biceps curl (DB)',
    ],
  },
  {
    name: 'Chest day',
    exercises: [
      'Incline DB press',
      'Bench press (barbell)',
      'Pec deck fly',
      'DB shoulder press',
      'DB lateral raise',
      'Triceps single-arm',
      'Face pulls',
    ],
  },
  {
    name: 'Leg day',
    exercises: ['Calf raise', 'Hip thrust', 'Squats', 'Hamstring curl'],
  },
  {
    name: 'Arms day',
    exercises: [
      'Overhead DB extension',
      'Cable biceps',
      'Triceps single-arm',
      'Hammer curl',
      'EZ barbell curl',
      'Shrugs',
      'Neck (front)',
      'Neck (back)',
      'Forearms',
    ],
  },
  {
    name: 'Leg Day 2',
    exercises: [
      'Bulgarian split squat',
      'RDL (barbell)',
      'Standing calf',
      'Adductors',
      'Wall ball',
      'Farmers walk',
    ],
  },
  {
    name: 'Hyrox sim',
    exercises: ['Run', 'Rowing', 'Farmers carry', 'Hanging knee raise'],
  },
];

// ---- Mobility movements -----------------------------------------------------
type Mob = { name: string; target?: string; hold?: number };

const WARMUP_GENERAL: Mob[] = [
  { name: 'Cat cow', target: '10' },
  { name: "World's greatest stretch", target: '15' },
  { name: 'Thoracic extension on foam roller', target: '15' },
  { name: 'Anchored lat stretch', target: '10-10-10' },
  { name: 'Swimmers stretch', target: '15' },
  { name: 'Pronation-supination', target: '20' },
  { name: 'Band pass-through', target: '15' },
  { name: 'Band high face pull', target: '25' },
];

const WARMUP_LEGS: Mob[] = [
  { name: 'Supine drawing-in', target: '10' },
  { name: 'Cat cow', target: '20' },
  { name: "World's greatest stretch", target: '10' },
  { name: 'Bird dog', target: '20' },
  { name: 'Fire hydrant', target: '25' },
  { name: 'Hinge to squat', target: '15' },
  { name: 'Glute bridge', target: '20 + 10s hold', hold: 10 },
  { name: 'Ankle glides', target: '20' },
];

const PUSH_UP_PLUS: Mob = { name: 'Push-up plus', target: '10' };
const SCAP_PULL_UP: Mob = { name: 'Scapular pull-up', target: '15' };
const PIGEON: Mob = { name: 'Pigeon stretch', target: '30s each side', hold: 30 };

// Warm-up composition per template.
const TEMPLATE_WARMUP: Record<string, Mob[]> = {
  'Back day': [...WARMUP_GENERAL, SCAP_PULL_UP],
  'Chest day': [...WARMUP_GENERAL, PUSH_UP_PLUS],
  'Arms day': [...WARMUP_GENERAL],
  'Hyrox sim': [...WARMUP_GENERAL],
  'Leg day': [...WARMUP_LEGS],
  'Leg Day 2': [...WARMUP_LEGS],
};

const COOLDOWN_ALL: Mob[] = [PIGEON];

async function seedIfEmpty(): Promise<void> {
  const existing = await db.select().from(muscleGroups).limit(1);
  if (existing.length > 0) return;

  // Muscle groups
  const mgRows = await db
    .insert(muscleGroups)
    .values(MUSCLES.map((name) => ({ name })))
    .returning();
  const mgId = new Map(mgRows.map((m) => [m.name, m.id]));

  // Exercises + primary muscle links
  const exRows = await db
    .insert(exercises)
    .values(
      Object.entries(EXERCISES).map(([name, def]) => ({
        name,
        metric: def.metric ?? 'weight_reps',
      }))
    )
    .returning();
  const exId = new Map(exRows.map((e) => [e.name, e.id]));

  await db.insert(exerciseMuscles).values(
    Object.entries(EXERCISES).map(([name, def]) => ({
      exerciseId: exId.get(name)!,
      muscleGroupId: mgId.get(def.muscle)!,
      isPrimary: true,
    }))
  );

  // Mobility movements (unique names across all lists)
  const allMob = [
    ...WARMUP_GENERAL,
    ...WARMUP_LEGS,
    PUSH_UP_PLUS,
    SCAP_PULL_UP,
    ...COOLDOWN_ALL,
  ];
  const uniqueMobNames = Array.from(new Set(allMob.map((m) => m.name)));
  const cooldownNames = new Set(COOLDOWN_ALL.map((m) => m.name));
  const mobRows = await db
    .insert(mobilityItems)
    .values(
      uniqueMobNames.map((name) => ({
        name,
        kind: cooldownNames.has(name) ? ('cooldown' as const) : ('warmup' as const),
      }))
    )
    .returning();
  const mobId = new Map(mobRows.map((m) => [m.name, m.id]));

  // Templates
  const tmplRows = await db
    .insert(dayTemplates)
    .values(TEMPLATES.map((t, i) => ({ name: t.name, rotationOrder: i + 1 })))
    .returning();
  const tmplId = new Map(tmplRows.map((t) => [t.name, t.id]));

  // Template -> exercises
  const teValues = TEMPLATES.flatMap((t) =>
    t.exercises.map((exName, idx) => ({
      templateId: tmplId.get(t.name)!,
      exerciseId: exId.get(exName)!,
      sortOrder: idx,
    }))
  );
  await db.insert(templateExercises).values(teValues);

  // Template -> mobility (warm-up + shared cool-down)
  const tmValues = TEMPLATES.flatMap((t) => {
    const warm = TEMPLATE_WARMUP[t.name] ?? WARMUP_GENERAL;
    const rows = warm.map((m, idx) => ({
      templateId: tmplId.get(t.name)!,
      mobilityItemId: mobId.get(m.name)!,
      targetReps: m.target ?? null,
      holdSeconds: m.hold ?? null,
      sortOrder: idx,
    }));
    const cool = COOLDOWN_ALL.map((m, idx) => ({
      templateId: tmplId.get(t.name)!,
      mobilityItemId: mobId.get(m.name)!,
      targetReps: m.target ?? null,
      holdSeconds: m.hold ?? null,
      sortOrder: 100 + idx,
    }));
    return [...rows, ...cool];
  });
  await db.insert(templateMobility).values(tmValues);

  // Historical training log → real sessions (fresh DB only).
  await insertHistory(exId, tmplId);

  // Settings singleton — deload cycle anchored to this week's Monday.
  await db.insert(settings).values({
    id: 1,
    deloadCycleStart: toISODate(mondayOf(new Date())),
  });
}

/** Idempotent: seeds reference data + settings only on a fresh database. */
export async function ensureSeeded(): Promise<void> {
  await seedIfEmpty();
}
