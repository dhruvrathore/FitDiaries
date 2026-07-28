import { db } from './client';
import { sessions, sessionExercises, sets } from './schema';
import type { Phase } from '@/theme/theme';

// A lift set: [weight, reps, note?]. null weight/reps = not recorded.
type LiftSet = [number | null, number | null, string?];
type CardioSet = { durationSec?: number; distanceM?: number; weight?: number; note?: string };
type HistExercise = { name: string; sets?: LiftSet[]; cardio?: CardioSet[] };
type HistSession = {
  day: string;
  phase: Phase;
  date: [number, number, number]; // [year, month(1-12), day]
  note?: string;
  exercises: HistExercise[];
};

// Dhruv's real training log, transcribed and dated chronologically (Jun 8 – Jul 21, 2026)
// so per-exercise progression, PRs, and weekly volume trends populate correctly.
const HISTORY: HistSession[] = [
  // ---------------- BACK DAY ----------------
  {
    day: 'Back day',
    phase: 'strength',
    date: [2026, 6, 8],
    exercises: [
      { name: 'Barbell row', sets: [[20, 7], [25, 5], [22.5, 5]] },
      { name: 'T-bar row', sets: [[30, 5], [30, 7], [35, 5]] },
      { name: 'Lat pulldown', sets: [[58, 4], [52, 5], [52, 6]] },
      { name: 'Biceps single preacher', sets: [[20, 5], [20, 5], [15, 7]] },
    ],
  },
  {
    day: 'Back day',
    phase: 'endurance',
    date: [2026, 6, 15],
    exercises: [
      { name: 'Lat pulldown', sets: [[26, 15], [32.5, 15], [39, 15], [45.5, 13]] },
      { name: 'T-bar row', sets: [[15, 15], [15, 15], [15, 15]] },
      { name: 'Barbell row', sets: [[10, 15], [12.5, 15], [12.5, 15]] },
      { name: 'Back extension', sets: [[8, 15], [8, 15], [8, 15]] },
      { name: 'Biceps single preacher', sets: [[5, 15], [10, 15, 'help'], [5, 15]] },
      { name: 'Face pulls', sets: [[15, 15], [15, 15], [15, 15, 'two ropes']] },
    ],
  },
  {
    day: 'Back day',
    phase: 'hypertrophy',
    date: [2026, 6, 22],
    exercises: [
      { name: 'Lat pulldown', sets: [[45, 12], [52, 8], [52, 8]] },
      { name: 'T-bar row', sets: [[25, 11], [25, 10], [25, 10]] },
      { name: 'Barbell row', sets: [[20, 12], [20, 12], [22.5, 8]] },
      { name: 'Back extension', sets: [[null, null, 'bodyweight'], [18, 12], [8, 10]] },
      { name: 'Biceps single preacher', sets: [[10, 12], [15, 10], [15, 6], [10, 4, 'drop']] },
    ],
  },
  {
    day: 'Back day',
    phase: 'hypertrophy',
    date: [2026, 6, 29],
    exercises: [
      { name: 'Lat pulldown', sets: [[45, 8], [45, 11], [39, 8]] },
      { name: 'T-bar row', sets: [[15, 12], [25, 10], [25, 7]] },
      { name: 'Barbell row', sets: [[20, 12], [20, 8]] },
      { name: 'Back extension', sets: [[18, 12], [18, 12], [18, 12]] },
      { name: 'Lat cable pressdown', sets: [[25, 12], [30, 10], [30, 8]] },
      { name: 'Biceps double preacher', sets: [[20, 12], [25, 12], [25, 11]] },
    ],
  },
  {
    day: 'Back day',
    phase: 'hypertrophy',
    date: [2026, 7, 6],
    exercises: [
      { name: 'Lat pulldown', sets: [[45, 10], [45, 8], [45, 8]] },
      { name: 'T-bar row', sets: [[25, 7], [20, 8], [20, 8]] },
      { name: 'Barbell row', sets: [[20, 12], [20, 10], [20, 8]] },
      { name: 'Back extension', sets: [[18, 12], [18, 12]] },
      { name: 'Biceps double preacher', sets: [[25, 12], [30, 10], [30, null]] },
    ],
  },
  {
    day: 'Back day',
    phase: 'hypertrophy',
    date: [2026, 7, 13],
    note: 'Ribs down, abs tight',
    exercises: [
      { name: 'T-bar row', sets: [[20, 8], [20, 8], [20, 8]] },
      { name: 'Lat pulldown', sets: [[45, 8], [45, 8], [45, 8]] },
      { name: 'Single-arm row', sets: [[20, 8], [20, 6], [15, 10]] },
      { name: 'Biceps double preacher', sets: [[25, 12], [30, 10], [30, 8]] },
    ],
  },
  {
    day: 'Back day',
    phase: 'hypertrophy',
    date: [2026, 7, 20],
    exercises: [
      { name: 'Lat pulldown', sets: [[45, 10], [50, 6], [45, 9]] },
      { name: 'T-bar row', sets: [[20, 10], [20, 8], [20, 10]] },
      { name: 'Single-arm row', sets: [[15, 8], [15, 8], [15, 8]] },
      { name: 'Biceps curl (DB)', sets: [[7.5, 12], [7.5, 12], [10, 10]] },
      {
        name: 'Rear-delt fly',
        sets: [[15, 8], [15, 10], [20, 10, 'single-arm on chest fly, slow eccentric']],
      },
    ],
  },

  // ---------------- CHEST DAY ----------------
  {
    day: 'Chest day',
    phase: 'strength',
    date: [2026, 6, 9],
    exercises: [
      { name: 'Incline DB press', sets: [[22.5, 7], [25, 7], [30, 5]] },
      { name: 'Bench press (barbell)', sets: [[20, 5], [25, 3], [20, 5]] },
      { name: 'DB lateral raise', sets: [[7.5, 7], [10, 7], [10, 7]] },
      { name: 'Triceps single-arm', sets: [[15, 7], [20, 7], [20, 5]] },
      { name: 'DB shoulder press', sets: [[15, 7], [20, 7], [22.5, 5, 'not enough strength']] },
    ],
  },
  {
    day: 'Chest day',
    phase: 'endurance',
    date: [2026, 6, 16],
    exercises: [
      { name: 'Incline DB press', sets: [[15, 15], [20, 15], [20, 15]] },
      { name: 'Bench press (barbell)', sets: [[10, 15], [7.5, 15], [10, 15]] },
      { name: 'DB shoulder press', sets: [[7.5, 15], [10, 15], [10, 15]] },
      { name: 'Triceps single-arm', sets: [[5, 15], [5, 15], [5, 15]] },
      { name: 'DB lateral raise', sets: [[5, 15], [5, 15], [5, 15]] },
    ],
  },
  {
    day: 'Chest day',
    phase: 'hypertrophy',
    date: [2026, 6, 23],
    exercises: [
      { name: 'Incline DB press', sets: [[20, 12], [22.5, 10], [22.5, 8]] },
      { name: 'Bench press (barbell)', sets: [[15, 12], [15, 8], [15, 8]] },
      { name: 'DB shoulder press', sets: [[10, 12], [12.5, 12], [12, null]] },
      { name: 'Triceps single-arm', sets: [[10, 12], [10, 12], [10, 10]] },
      { name: 'DB lateral raise', sets: [[7.5, 12], [7.5, 12], [7.5, 8]] },
    ],
  },
  {
    day: 'Chest day',
    phase: 'hypertrophy',
    date: [2026, 6, 30],
    exercises: [
      { name: 'Incline DB press', sets: [[15, 12], [20, 12], [22.5, 8]] },
      { name: 'Bench press (barbell)', sets: [[15, 8], [15, 8], [15, 8]] },
      { name: 'DB shoulder press', sets: [[10, 10], [10, 8], [10, 10]] },
      { name: 'Triceps single-arm', sets: [[15, 12], [15, 12], [15, 12]] },
      { name: 'DB lateral raise', sets: [[7.5, 8], [7.5, 12], [7.5, 12]] },
    ],
  },
  {
    day: 'Chest day',
    phase: 'hypertrophy',
    date: [2026, 7, 7],
    exercises: [
      { name: 'Incline DB press', sets: [[20, 12], [20, 10], [20, 8]] },
      { name: 'Bench press (barbell)', sets: [[15, 8], [17.5, 8], [17.5, 5], [15, 3, 'drop']] },
      { name: 'DB shoulder press', sets: [[10, 12], [12.5, 8], [12.5, 7]] },
      { name: 'Triceps single-arm', sets: [[15, 12], [15, 12], [15, 12]] },
      { name: 'DB lateral raise', sets: [[7.5, 12], [10, 8], [10, 8]] },
    ],
  },
  {
    day: 'Chest day',
    phase: 'hypertrophy',
    date: [2026, 7, 14],
    exercises: [
      { name: 'Incline DB press', sets: [[20, 12], [20, 12], [22.5, 8]] },
      { name: 'Bench press (barbell)', sets: [[15, 8], [15, 10], [17.5, 6]] },
      { name: 'DB shoulder press', sets: [[12.5, 12], [12.5, 12], [15, 6]] },
      { name: 'Triceps single-arm', sets: [[15, 8], [15, 8], [15, 8]] },
      { name: 'DB lateral raise', sets: [[7.5, 12], [10, 8], [10, 8]] },
      { name: 'Face pulls', sets: [[null, 20]] },
    ],
  },
  {
    day: 'Chest day',
    phase: 'hypertrophy',
    date: [2026, 7, 21],
    exercises: [
      { name: 'Pec deck fly', sets: [[25, 10], [25, 10], [35, 8]] },
      { name: 'Incline DB press', sets: [[20, 8], [20, 10], [20, 12]] },
      { name: 'Bench press (barbell)', sets: [[15, 8], [20, 4]] },
      { name: 'DB lateral raise', sets: [[7.5, 12], [7.5, 12], [7.5, 12]] },
      { name: 'Triceps single-arm', sets: [[15, 12], [15, 12], [20, 8]] },
      { name: 'DB shoulder press', sets: [[12.5, 12], [15, null]] },
    ],
  },

  // ---------------- LEG DAY ----------------
  {
    day: 'Leg day',
    phase: 'strength',
    date: [2026, 6, 11],
    exercises: [
      { name: 'Calf raise', sets: [[30, 5], [25, 7], [25, 7, 'ankles forward cue']] },
      { name: 'Hip thrust', sets: [[20, 7], [30, 7], [50, null]] },
      { name: 'Squats', sets: [[20, 5], [25, 5], [25, 4]] },
      { name: 'Hamstring curl', sets: [[50, 7], [70, 7], [65, 5]] },
    ],
  },
  {
    day: 'Leg day',
    phase: 'endurance',
    date: [2026, 6, 18],
    exercises: [
      { name: 'Calf raise', sets: [[5, 15], [10, 15], [10, 15]] },
      { name: 'Hip thrust', sets: [[10, 15], [15, 15], [25, 15]] },
      { name: 'Squats', sets: [[7.5, 15], [7.5, 15], [10, 15, 'elbows back, ears away from neck']] },
      { name: 'Hamstring curl', sets: [[30, 15], [35, 15], [40, 15]] },
    ],
  },
  {
    day: 'Leg day',
    phase: 'hypertrophy',
    date: [2026, 6, 25],
    exercises: [
      { name: 'Calf raise', sets: [[10, 12], [20, 12], [20, 10]] },
      { name: 'Hip thrust', sets: [[15, 12], [25, 12], [35, 12]] },
      { name: 'Squats', sets: [[12.5, 8], [12.5, 12], [15, 12]] },
      { name: 'Hamstring curl', sets: [[40, 12], [45, 12], [50, 8]] },
    ],
  },
  {
    day: 'Leg day',
    phase: 'hypertrophy',
    date: [2026, 7, 2],
    exercises: [
      { name: 'Calf raise', sets: [[15, 12], [20, 10], [20, 8]] },
      { name: 'Hip thrust', sets: [[35, 12], [35, 10], [45, 10]] },
      { name: 'Squats', sets: [[15, 10], [15, 12], [20, 8]] },
      { name: 'Hamstring curl', sets: [[45, 12], [50, 12], [55, 10]] },
    ],
  },
  {
    day: 'Leg day',
    phase: 'hypertrophy',
    date: [2026, 7, 9],
    exercises: [
      { name: 'Calf raise', sets: [[15, 12], [20, 12], [25, 12]] },
      { name: 'Hip thrust', sets: [[35, 12], [40, 12], [40, 12]] },
      { name: 'Squats', sets: [[15, 8], [15, 4], [15, 4, 'slight knee pain']] },
      { name: 'Hamstring curl', sets: [[50, 12], [55, 8], [50, 10]] },
    ],
  },
  {
    day: 'Leg day',
    phase: 'hypertrophy',
    date: [2026, 7, 16],
    exercises: [
      { name: 'Hip thrust', sets: [[40, 10], [40, 10], [40, 10]] },
      { name: 'Calf raise', sets: [[15, 12], [20, 10], [20, 6]] },
      { name: 'Squats', sets: [[15, 8], [15, 8], [15, 6]] },
      { name: 'Hamstring curl', sets: [[55, 10], [55, 8]] },
    ],
  },

  // ---------------- ARMS DAY ----------------
  {
    day: 'Arms day',
    phase: 'strength',
    date: [2026, 6, 12],
    exercises: [
      { name: 'Overhead DB extension', sets: [[22.5, 8], [25, 7], [27.5, null]] },
      { name: 'Cable biceps', sets: [[20, 7], [25, 5], [25, 4]] },
      { name: 'Triceps single-arm', sets: [[10, 8], [10, 10], [15, 5]] },
      { name: 'Hammer curl', sets: [[12.5, 7], [15, 5], [15, 5]] },
      { name: 'Neck (front)', sets: [[5, 20]] },
      { name: 'Neck (back)', sets: [[5, 20]] },
      { name: 'Forearms', sets: [[null, null, 'front & back']] },
    ],
  },
  {
    day: 'Arms day',
    phase: 'endurance',
    date: [2026, 6, 19],
    exercises: [
      { name: 'Overhead DB extension', sets: [[15, 15], [17.5, 15], [20, 15]] },
      { name: 'Cable biceps', sets: [[10, 15], [15, 15], [15, 15, 'last set tough']] },
      { name: 'Triceps single-arm', sets: [[5, 15], [10, 15], [10, 15]] },
      { name: 'Hammer curl', sets: [[7.5, 15], [10, 15], [10, 14, 'with breaks']] },
      { name: 'Neck (front)', sets: [[5, 20]] },
      { name: 'Neck (back)', sets: [[5, 20]] },
      { name: 'Forearms', sets: [[null, 20, 'front & back']] },
    ],
  },
  {
    day: 'Arms day',
    phase: 'hypertrophy',
    date: [2026, 6, 26],
    exercises: [
      { name: 'Overhead DB extension', sets: [[20, 12], [25, 12], [25, 8]] },
      { name: 'Cable biceps', sets: [[15, 12], [20, 12], [20, 8]] },
      { name: 'Triceps single-arm', sets: [[15, 12], [20, 10], [20, 4]] },
      { name: 'Hammer curl', sets: [[10, 12], [12.5, 8], [12.5, 8]] },
      { name: 'Shrugs', sets: [[17.5, 15], [20, 15], [25, 15]] },
      { name: 'Neck (front)', sets: [[null, 20]] },
      { name: 'Neck (back)', sets: [[null, 20]] },
      { name: 'Forearms', sets: [[null, 20, 'front & back']] },
    ],
  },
  {
    day: 'Arms day',
    phase: 'hypertrophy',
    date: [2026, 7, 3],
    exercises: [
      { name: 'Overhead DB extension', sets: [[20, 12], [20, 8], [20, 6]] },
      { name: 'Hammer curl', sets: [[10, 12], [10, 12], [10, 10]] },
      { name: 'Triceps single-arm', sets: [[15, 12], [15, 12], [15, 8]] },
      { name: 'EZ barbell curl', sets: [[15, 12], [15, 12], [15, 12]] },
      { name: 'Shrugs', sets: [[20, 12], [25, 12], [25, 8]] },
      { name: 'Neck (front)', sets: [[5, 10], [5, 10]] },
      { name: 'Neck (back)', sets: [[5, 10], [5, 10]] },
    ],
  },

  // ---------------- LEG DAY 2 ----------------
  {
    day: 'Leg Day 2',
    phase: 'strength',
    date: [2026, 6, 13],
    exercises: [
      { name: 'Bulgarian split squat', sets: [[20, 7], [22.5, 7], [25, 5]] },
      { name: 'RDL (barbell)', sets: [[15, 7], [20, 5], [20, 5]] },
      { name: 'Standing calf', sets: [[20, 7], [25, 7], [30, 5]] },
      { name: 'Adductors', sets: [[40, 7], [40, 7], [45, 7]] },
    ],
  },
  {
    day: 'Leg Day 2',
    phase: 'endurance',
    date: [2026, 6, 20],
    exercises: [
      { name: 'Bulgarian split squat', sets: [[10, 15], [12.5, 15], [15, 15]] },
      { name: 'RDL (barbell)', sets: [[7.5, 15], [10, 15], [12.5, 15]] },
      { name: 'Standing calf', sets: [[20, 15], [20, 15], [20, 15, 'one break']] },
      { name: 'Adductors', sets: [[30, 15], [30, 15], [35, 15]] },
      { name: 'Wall ball', sets: [[6, 10], [6, 15], [6, 15]] },
      { name: 'Farmers walk', cardio: [{ weight: 25, distanceM: 60 }] },
    ],
  },
  {
    day: 'Leg Day 2',
    phase: 'hypertrophy',
    date: [2026, 7, 4],
    exercises: [
      { name: 'Bulgarian split squat', sets: [[15, 12], [17.5, 12], [20, 12]] },
      { name: 'RDL (barbell)', sets: [[15, 12], [15, 12]] },
      { name: 'Standing calf', sets: [[20, 12], [20, 12]] },
    ],
  },

  // ---------------- HYROX SIM ----------------
  {
    day: 'Hyrox sim',
    phase: 'endurance',
    date: [2026, 6, 21],
    note: '5 min warm up',
    exercises: [
      {
        name: 'Run',
        cardio: [
          { distanceM: 1000 },
          { distanceM: 1000 },
          { distanceM: 1000 },
          { distanceM: 1000 },
        ],
      },
      { name: 'Rowing', cardio: [{ durationSec: 300 }, { durationSec: 300 }] },
      {
        name: 'Farmers carry',
        cardio: [
          { weight: 25, distanceM: 100, note: '2 breaks' },
          { weight: 25, distanceM: 200, note: 'stops at 40m' },
        ],
      },
      { name: 'Hanging knee raise', sets: [[null, 10], [null, 8], [null, 8]] },
    ],
  },
];

/**
 * Inserts the historical training log as real sessions on a fresh database.
 * `exId` maps exercise name → id; `tmplId` maps template name → id.
 */
export async function insertHistory(
  exId: Map<string, number>,
  tmplId: Map<string, number>
): Promise<void> {
  for (const session of HISTORY) {
    const [y, m, d] = session.date;
    const startedAt = new Date(y, m - 1, d, 18, 0, 0).getTime();
    const [row] = await db
      .insert(sessions)
      .values({
        templateId: tmplId.get(session.day) ?? null,
        dayName: session.day,
        phase: session.phase,
        startedAt,
        finishedAt: startedAt + 60 * 60 * 1000,
        notes: session.note ?? null,
      })
      .returning({ id: sessions.id });

    for (let i = 0; i < session.exercises.length; i++) {
      const ex = session.exercises[i];
      const exerciseId = exId.get(ex.name);
      if (exerciseId == null) {
        console.warn('[seedHistory] unknown exercise:', ex.name);
        continue;
      }
      const [seRow] = await db
        .insert(sessionExercises)
        .values({ sessionId: row.id, exerciseId, sortOrder: i })
        .returning({ id: sessionExercises.id });

      const rows: (typeof sets.$inferInsert)[] = [];
      if (ex.sets) {
        ex.sets.forEach(([weight, reps, note], j) => {
          rows.push({
            sessionExerciseId: seRow.id,
            setNumber: j + 1,
            weight,
            reps,
            note: note ?? null,
          });
        });
      }
      if (ex.cardio) {
        ex.cardio.forEach((c, j) => {
          rows.push({
            sessionExerciseId: seRow.id,
            setNumber: (ex.sets?.length ?? 0) + j + 1,
            weight: c.weight ?? null,
            reps: null,
            durationSec: c.durationSec ?? null,
            distanceM: c.distanceM ?? null,
            note: c.note ?? null,
          });
        });
      }
      if (rows.length > 0) await db.insert(sets).values(rows);
    }
  }
}
