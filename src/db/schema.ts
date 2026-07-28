import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Muscle groups used for volume-by-muscle attribution. */
export const muscleGroups = sqliteTable('muscle_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

/** An exercise. `metric` decides the logging UI: weight×reps vs cardio (time/distance). */
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  metric: text('metric', { enum: ['weight_reps', 'cardio'] })
    .notNull()
    .default('weight_reps'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  /** Free-text form cues shown while doing the exercise (one per line). */
  cues: text('cues'),
  /** Optional local image (uri) shown while doing the exercise. */
  imageUri: text('image_uri'),
  /** Default rest between sets (seconds); null falls back to the settings default. */
  restSeconds: integer('rest_seconds'),
});

/** Which muscle(s) an exercise trains. Primary muscle receives the set's volume. */
export const exerciseMuscles = sqliteTable('exercise_muscles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  muscleGroupId: integer('muscle_group_id')
    .notNull()
    .references(() => muscleGroups.id, { onDelete: 'cascade' }),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
});

/** A workout-day template (Back day, Chest day, ...). */
export const dayTemplates = sqliteTable('day_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  rotationOrder: integer('rotation_order').notNull(),
});

export const templateExercises = sqliteTable('template_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id')
    .notNull()
    .references(() => dayTemplates.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Prescribed number of working sets. */
  targetSets: integer('target_sets'),
  /** Tempo string, e.g. "3-1-1-0" (concentric-peak-eccentric-bottom seconds). */
  tempo: text('tempo'),
  /** Per-day rest override (seconds); null falls back to the exercise/settings default. */
  restSeconds: integer('rest_seconds'),
});

/** A prescribed warm-up set for an exercise within a template. */
export const templateExerciseWarmups = sqliteTable('template_exercise_warmups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateExerciseId: integer('template_exercise_id')
    .notNull()
    .references(() => templateExercises.id, { onDelete: 'cascade' }),
  /** Percentage of last week's top working set (0-100); null when fixedWeight is used. */
  percent: real('percent'),
  /** Fixed weight in kg; null when percent is used. */
  fixedWeight: real('fixed_weight'),
  reps: integer('reps'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Warm-up / cool-down mobility movement. Target reps / hold are per-template (see join). */
export const mobilityItems = sqliteTable('mobility_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  kind: text('kind', { enum: ['warmup', 'cooldown'] }).notNull(),
  /** Region this movement targets, e.g. "Hips / glutes". */
  bodyPart: text('body_part'),
  /** Free-text form cues shown during the workout. */
  cues: text('cues'),
  /** Optional local image (uri) shown during the workout. */
  imageUri: text('image_uri'),
});

// The same movement (e.g. Cat cow) can be prescribed differently per day, so the
// target reps and any timed hold live on this join, not on the item.
export const templateMobility = sqliteTable('template_mobility', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id')
    .notNull()
    .references(() => dayTemplates.id, { onDelete: 'cascade' }),
  mobilityItemId: integer('mobility_item_id')
    .notNull()
    .references(() => mobilityItems.id, { onDelete: 'cascade' }),
  targetReps: text('target_reps'),
  holdSeconds: integer('hold_seconds'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** A logged workout session. */
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id').references(() => dayTemplates.id, {
    onDelete: 'set null',
  }),
  dayName: text('day_name').notNull(),
  phase: text('phase', {
    enum: ['strength', 'hypertrophy', 'endurance', 'deload'],
  }).notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  notes: text('notes'),
});

export const sessionExercises = sqliteTable('session_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** A single working set. weight/reps for lifts; durationSec/distanceM for cardio. */
export const sets = sqliteTable('sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionExerciseId: integer('session_exercise_id')
    .notNull()
    .references(() => sessionExercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  weight: real('weight'),
  reps: integer('reps'),
  durationSec: integer('duration_sec'),
  distanceM: integer('distance_m'),
  note: text('note'),
  /** Warm-up sets are excluded from volume, PRs, and history/prefill. */
  isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
});

export const mobilityChecks = sqliteTable('mobility_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  mobilityItemId: integer('mobility_item_id')
    .notNull()
    .references(() => mobilityItems.id, { onDelete: 'cascade' }),
  checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
  note: text('note'),
});

/** Weekly progress photo. weekStart is the ISO Monday date (YYYY-MM-DD). */
export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  weekStart: text('week_start').notNull(),
  uri: text('uri').notNull(),
  takenAt: integer('taken_at').notNull(),
  note: text('note'),
});

/** Singleton settings row (id = 1). */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  notificationDay: integer('notification_day').notNull().default(1), // 1 = Monday
  notificationHour: integer('notification_hour').notNull().default(9),
  notificationMinute: integer('notification_minute').notNull().default(0),
  restSeconds: integer('rest_seconds').notNull().default(90),
  restSoundEnabled: integer('rest_sound_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  deloadCycleStart: text('deload_cycle_start').notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch() * 1000)`),
});

export type Exercise = typeof exercises.$inferSelect;
export type MuscleGroup = typeof muscleGroups.$inferSelect;
export type DayTemplate = typeof dayTemplates.$inferSelect;
export type MobilityItem = typeof mobilityItems.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type TemplateExerciseWarmup = typeof templateExerciseWarmups.$inferSelect;
export type WorkSet = typeof sets.$inferSelect;
export type MobilityCheck = typeof mobilityChecks.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Settings = typeof settings.$inferSelect;
