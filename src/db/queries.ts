import { and, eq } from 'drizzle-orm';

import { db, expoDb } from './client';
import {
  dayTemplates,
  exerciseMuscles,
  exercises,
  mobilityChecks,
  mobilityItems,
  photos,
  sessionExercises,
  sessions,
  sets,
  settings as settingsTable,
  templateExercises,
  templateExerciseWarmups,
  templateMobility,
} from './schema';
import type { Phase } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TemplateRow = { id: number; name: string; rotationOrder: number };

export async function listTemplates(): Promise<TemplateRow[]> {
  return expoDb.getAllAsync<TemplateRow>(
    `SELECT id, name, rotation_order as rotationOrder FROM day_templates ORDER BY rotation_order`
  );
}

export type TemplateExerciseRow = {
  exerciseId: number;
  name: string;
  metric: 'weight_reps' | 'cardio';
  muscle: string | null;
};

export async function templateExerciseDetail(
  templateId: number
): Promise<TemplateExerciseRow[]> {
  return expoDb.getAllAsync<TemplateExerciseRow>(
    `SELECT e.id as exerciseId, e.name as name, e.metric as metric,
            mg.name as muscle
     FROM template_exercises te
     JOIN exercises e ON e.id = te.exercise_id
     LEFT JOIN exercise_muscles em ON em.exercise_id = e.id AND em.is_primary = 1
     LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
     WHERE te.template_id = ?
     ORDER BY te.sort_order`,
    [templateId]
  );
}

export type MobilityRow = {
  mobilityItemId: number;
  name: string;
  kind: 'warmup' | 'cooldown';
  targetReps: string | null;
  holdSeconds: number | null;
  bodyPart: string | null;
  cues: string | null;
  imageUri: string | null;
};

export async function templateMobilityDetail(templateId: number): Promise<MobilityRow[]> {
  return expoDb.getAllAsync<MobilityRow>(
    `SELECT mi.id as mobilityItemId, mi.name as name, mi.kind as kind,
            tm.target_reps as targetReps, tm.hold_seconds as holdSeconds,
            mi.body_part as bodyPart, mi.cues as cues, mi.image_uri as imageUri
     FROM template_mobility tm
     JOIN mobility_items mi ON mi.id = tm.mobility_item_id
     WHERE tm.template_id = ?
     ORDER BY tm.sort_order`,
    [templateId]
  );
}

/** Next template in the standard rotation, based on the last finished session. */
export async function suggestedTemplateId(): Promise<number | null> {
  const templates = await listTemplates();
  if (templates.length === 0) return null;
  const last = await expoDb.getFirstAsync<{ rotationOrder: number }>(
    `SELECT dt.rotation_order as rotationOrder
     FROM sessions s JOIN day_templates dt ON dt.id = s.template_id
     WHERE s.finished_at IS NOT NULL AND s.template_id IS NOT NULL
     ORDER BY s.finished_at DESC LIMIT 1`
  );
  if (!last) return templates[0].id;
  const idx = templates.findIndex((t) => t.rotationOrder === last.rotationOrder);
  const next = templates[(idx + 1) % templates.length];
  return next.id;
}

// ---------------------------------------------------------------------------
// Template editing (days, their exercises, and their mobility)
// ---------------------------------------------------------------------------

export type TemplateListRow = TemplateRow & { exerciseCount: number };

/** Templates with their exercise count, for the manager list. */
export async function listTemplatesWithCounts(): Promise<TemplateListRow[]> {
  return expoDb.getAllAsync<TemplateListRow>(
    `SELECT dt.id, dt.name, dt.rotation_order as rotationOrder,
            COUNT(te.id) as exerciseCount
     FROM day_templates dt
     LEFT JOIN template_exercises te ON te.template_id = dt.id
     GROUP BY dt.id
     ORDER BY dt.rotation_order`
  );
}

export async function createTemplate(name: string): Promise<number> {
  const prev = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(rotation_order), 0) as n FROM day_templates`
  );
  const [row] = await db
    .insert(dayTemplates)
    .values({ name: await uniqueTemplateName(name.trim()), rotationOrder: (prev?.n ?? 0) + 1 })
    .returning({ id: dayTemplates.id });
  return row.id;
}

/** day_templates.name is UNIQUE; pick the first free "Base", "Base 2", "Base 3", … */
async function uniqueTemplateName(base: string): Promise<string> {
  const rows = await expoDb.getAllAsync<{ name: string }>(
    `SELECT name FROM day_templates`
  );
  const taken = new Set(rows.map((r) => r.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function renameTemplate(id: number, name: string): Promise<void> {
  await db.update(dayTemplates).set({ name: name.trim() }).where(eq(dayTemplates.id, id));
}

export async function deleteTemplate(id: number): Promise<void> {
  await db.delete(dayTemplates).where(eq(dayTemplates.id, id));
}

/** Persist a new rotation order from an ordered list of template ids. */
export async function reorderTemplates(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return;
  // Single statement so the DB change listener fires once, after the drag
  // gesture has settled — writing row-by-row replaces the list mid-gesture and
  // crashes the reorderable list.
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${i + 1}`).join(' ');
  const ins = orderedIds.map(() => '?').join(',');
  await expoDb.runAsync(
    `UPDATE day_templates SET rotation_order = CASE id ${cases} END WHERE id IN (${ins})`,
    [...orderedIds, ...orderedIds]
  );
}

export type TemplateExerciseEditRow = {
  id: number; // template_exercises row id
  exerciseId: number;
  name: string;
  muscle: string | null;
  sortOrder: number;
  targetSets: number | null;
  tempo: string | null;
  restSeconds: number | null;
};

/** Exercises in a template, including the join-row id needed to remove/reorder. */
export async function templateExercisesForEdit(
  templateId: number
): Promise<TemplateExerciseEditRow[]> {
  return expoDb.getAllAsync<TemplateExerciseEditRow>(
    `SELECT te.id as id, e.id as exerciseId, e.name as name, mg.name as muscle,
            te.sort_order as sortOrder, te.target_sets as targetSets,
            te.tempo as tempo, te.rest_seconds as restSeconds
     FROM template_exercises te
     JOIN exercises e ON e.id = te.exercise_id
     LEFT JOIN exercise_muscles em ON em.exercise_id = e.id AND em.is_primary = 1
     LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
     WHERE te.template_id = ?
     ORDER BY te.sort_order`,
    [templateId]
  );
}

export async function addTemplateExercise(
  templateId: number,
  exerciseId: number
): Promise<void> {
  const prev = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) as n FROM template_exercises WHERE template_id = ?`,
    [templateId]
  );
  await db
    .insert(templateExercises)
    .values({ templateId, exerciseId, sortOrder: (prev?.n ?? -1) + 1 });
}

export async function removeTemplateExercise(templateExerciseId: number): Promise<void> {
  await db.delete(templateExercises).where(eq(templateExercises.id, templateExerciseId));
}

export async function reorderTemplateExercises(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return;
  // See reorderTemplates: one statement -> one change notification, after the gesture.
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${i}`).join(' ');
  const ins = orderedIds.map(() => '?').join(',');
  await expoDb.runAsync(
    `UPDATE template_exercises SET sort_order = CASE id ${cases} END WHERE id IN (${ins})`,
    [...orderedIds, ...orderedIds]
  );
}

/** Set target sets / tempo / per-day rest override on a template exercise. */
export async function setTemplateExerciseConfig(
  templateExerciseId: number,
  patch: { targetSets?: number | null; tempo?: string | null; restSeconds?: number | null }
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.targetSets !== undefined) set.targetSets = patch.targetSets;
  if (patch.tempo !== undefined) {
    const t = patch.tempo?.trim();
    set.tempo = t ? t : null;
  }
  if (patch.restSeconds !== undefined) set.restSeconds = patch.restSeconds;
  if (Object.keys(set).length === 0) return;
  await db.update(templateExercises).set(set).where(eq(templateExercises.id, templateExerciseId));
}

// ---- template exercise warm-up sets ----

export type TemplateWarmupRow = {
  id: number;
  percent: number | null;
  fixedWeight: number | null;
  reps: number | null;
  sortOrder: number;
};

export type TemplateExerciseConfig = {
  id: number;
  exerciseName: string;
  templateName: string;
  muscle: string | null;
  targetSets: number | null;
  tempo: string | null;
  restSeconds: number | null;
};

export async function getTemplateExerciseConfig(
  templateExerciseId: number
): Promise<TemplateExerciseConfig | null> {
  return expoDb.getFirstAsync<TemplateExerciseConfig>(
    `SELECT te.id as id, e.name as exerciseName, dt.name as templateName, mg.name as muscle,
            te.target_sets as targetSets, te.tempo as tempo, te.rest_seconds as restSeconds
     FROM template_exercises te
     JOIN exercises e ON e.id = te.exercise_id
     JOIN day_templates dt ON dt.id = te.template_id
     LEFT JOIN exercise_muscles em ON em.exercise_id = e.id AND em.is_primary = 1
     LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
     WHERE te.id = ?`,
    [templateExerciseId]
  );
}

export async function listTemplateWarmups(
  templateExerciseId: number
): Promise<TemplateWarmupRow[]> {
  return expoDb.getAllAsync<TemplateWarmupRow>(
    `SELECT id, percent, fixed_weight as fixedWeight, reps, sort_order as sortOrder
     FROM template_exercise_warmups
     WHERE template_exercise_id = ? ORDER BY sort_order`,
    [templateExerciseId]
  );
}

export async function addTemplateWarmup(
  templateExerciseId: number,
  values: { percent?: number | null; fixedWeight?: number | null; reps?: number | null }
): Promise<void> {
  const prev = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) as n FROM template_exercise_warmups WHERE template_exercise_id = ?`,
    [templateExerciseId]
  );
  await db.insert(templateExerciseWarmups).values({
    templateExerciseId,
    percent: values.percent ?? null,
    fixedWeight: values.fixedWeight ?? null,
    reps: values.reps ?? null,
    sortOrder: (prev?.n ?? -1) + 1,
  });
}

export async function updateTemplateWarmup(
  id: number,
  patch: { percent?: number | null; fixedWeight?: number | null; reps?: number | null }
): Promise<void> {
  await db.update(templateExerciseWarmups).set(patch).where(eq(templateExerciseWarmups.id, id));
}

export async function removeTemplateWarmup(id: number): Promise<void> {
  await db.delete(templateExerciseWarmups).where(eq(templateExerciseWarmups.id, id));
}

// ---- template mobility (warm-up / cool-down) ----

export type MobilityItemRow = {
  id: number;
  name: string;
  kind: 'warmup' | 'cooldown';
  bodyPart: string | null;
  cues: string | null;
  imageUri: string | null;
};

export async function listMobilityItems(kind: 'warmup' | 'cooldown'): Promise<MobilityItemRow[]> {
  return expoDb.getAllAsync<MobilityItemRow>(
    `SELECT id, name, kind, body_part as bodyPart, cues, image_uri as imageUri
     FROM mobility_items WHERE kind = ? ORDER BY name`,
    [kind]
  );
}

export async function createMobilityItem(
  name: string,
  kind: 'warmup' | 'cooldown'
): Promise<number> {
  const [row] = await db
    .insert(mobilityItems)
    .values({ name: name.trim(), kind })
    .returning({ id: mobilityItems.id });
  return row.id;
}

/** All mobility movements (both kinds) for the global catalog manager. */
export async function listMobilityItemsAll(): Promise<MobilityItemRow[]> {
  return expoDb.getAllAsync<MobilityItemRow>(
    `SELECT id, name, kind, body_part as bodyPart, cues, image_uri as imageUri
     FROM mobility_items ORDER BY kind, name`
  );
}

export async function renameMobilityItem(id: number, name: string): Promise<void> {
  await db.update(mobilityItems).set({ name: name.trim() }).where(eq(mobilityItems.id, id));
}

/** Update a movement's editable fields (name, body part, cues, image). */
export async function updateMobilityItem(
  id: number,
  patch: { name?: string; bodyPart?: string | null; cues?: string | null; imageUri?: string | null }
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.bodyPart !== undefined) set.bodyPart = patch.bodyPart;
  if (patch.cues !== undefined) {
    const t = patch.cues?.trim();
    set.cues = t ? t : null;
  }
  if (patch.imageUri !== undefined) set.imageUri = patch.imageUri;
  if (Object.keys(set).length === 0) return;
  await db.update(mobilityItems).set(set).where(eq(mobilityItems.id, id));
}

/** Delete a movement. Cascades to template_mobility and mobility_checks. */
export async function deleteMobilityItem(id: number): Promise<void> {
  await db.delete(mobilityItems).where(eq(mobilityItems.id, id));
}

/** How many templates (days) currently include this movement. */
export async function mobilityItemUsage(id: number): Promise<number> {
  const row = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COUNT(DISTINCT template_id) as n FROM template_mobility WHERE mobility_item_id = ?`,
    [id]
  );
  return row?.n ?? 0;
}

export type TemplateMobilityEditRow = {
  id: number; // template_mobility row id
  mobilityItemId: number;
  name: string;
  targetReps: string | null;
  holdSeconds: number | null;
  sortOrder: number;
};

/** Mobility items in a template for a given kind, with join-row id for edit. */
export async function templateMobilityForEdit(
  templateId: number,
  kind: 'warmup' | 'cooldown'
): Promise<TemplateMobilityEditRow[]> {
  return expoDb.getAllAsync<TemplateMobilityEditRow>(
    `SELECT tm.id as id, mi.id as mobilityItemId, mi.name as name,
            tm.target_reps as targetReps, tm.hold_seconds as holdSeconds,
            tm.sort_order as sortOrder
     FROM template_mobility tm
     JOIN mobility_items mi ON mi.id = tm.mobility_item_id
     WHERE tm.template_id = ? AND mi.kind = ?
     ORDER BY tm.sort_order`,
    [templateId, kind]
  );
}

export async function addTemplateMobility(
  templateId: number,
  mobilityItemId: number,
  values: { targetReps?: string | null; holdSeconds?: number | null } = {}
): Promise<void> {
  const prev = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) as n FROM template_mobility WHERE template_id = ?`,
    [templateId]
  );
  await db.insert(templateMobility).values({
    templateId,
    mobilityItemId,
    targetReps: values.targetReps ?? null,
    holdSeconds: values.holdSeconds ?? null,
    sortOrder: (prev?.n ?? -1) + 1,
  });
}

export async function updateTemplateMobility(
  templateMobilityId: number,
  patch: { targetReps?: string | null; holdSeconds?: number | null }
): Promise<void> {
  await db.update(templateMobility).set(patch).where(eq(templateMobility.id, templateMobilityId));
}

export async function removeTemplateMobility(templateMobilityId: number): Promise<void> {
  await db.delete(templateMobility).where(eq(templateMobility.id, templateMobilityId));
}

export async function reorderTemplateMobility(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return;
  // See reorderTemplates: one statement -> one change notification, after the gesture.
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${i}`).join(' ');
  const ins = orderedIds.map(() => '?').join(',');
  await expoDb.runAsync(
    `UPDATE template_mobility SET sort_order = CASE id ${cases} END WHERE id IN (${ins})`,
    [...orderedIds, ...orderedIds]
  );
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSessionFromTemplate(
  template: TemplateRow,
  phase: Phase,
  bodyWeight: number | null = null
): Promise<number> {
  const [row] = await db
    .insert(sessions)
    .values({
      templateId: template.id,
      dayName: template.name,
      phase,
      startedAt: Date.now(),
      bodyWeight,
    })
    .returning({ id: sessions.id });

  const tmplExercises = await db
    .select()
    .from(templateExercises)
    .where(eq(templateExercises.templateId, template.id));

  if (tmplExercises.length > 0) {
    await db.insert(sessionExercises).values(
      tmplExercises
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((te, i) => ({
          sessionId: row.id,
          exerciseId: te.exerciseId,
          sortOrder: i,
        }))
    );
  }
  return row.id;
}

export type SessionHeader = {
  id: number;
  templateId: number | null;
  dayName: string;
  phase: Phase;
  startedAt: number;
  finishedAt: number | null;
  notes: string | null;
  bodyWeight: number | null;
};

export async function getActiveSession(): Promise<SessionHeader | null> {
  return expoDb.getFirstAsync<SessionHeader>(
    `SELECT id, template_id as templateId, day_name as dayName, phase,
            started_at as startedAt, finished_at as finishedAt, notes,
            body_weight as bodyWeight
     FROM sessions WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1`
  );
}

export async function getSessionHeader(sessionId: number): Promise<SessionHeader | null> {
  return expoDb.getFirstAsync<SessionHeader>(
    `SELECT id, template_id as templateId, day_name as dayName, phase,
            started_at as startedAt, finished_at as finishedAt, notes,
            body_weight as bodyWeight
     FROM sessions WHERE id = ?`,
    [sessionId]
  );
}

/** Most recent recorded body weight (kg), for prefilling the next weigh-in. Null if none. */
export async function lastBodyWeight(): Promise<number | null> {
  const row = await expoDb.getFirstAsync<{ bodyWeight: number }>(
    `SELECT body_weight as bodyWeight FROM sessions
     WHERE body_weight IS NOT NULL ORDER BY started_at DESC LIMIT 1`
  );
  return row?.bodyWeight ?? null;
}

/** Body-weight weigh-ins over time (kg), oldest first, for the Progress trend chart. */
export async function bodyWeightSeries(): Promise<{ at: number; weight: number }[]> {
  return expoDb.getAllAsync<{ at: number; weight: number }>(
    `SELECT started_at as at, body_weight as weight FROM sessions
     WHERE body_weight IS NOT NULL ORDER BY started_at ASC`
  );
}

export type SessionSet = {
  id: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  note: string | null;
  isWarmup: boolean;
};

export type SessionExerciseDetail = {
  sessionExerciseId: number;
  exerciseId: number;
  name: string;
  metric: 'weight_reps' | 'cardio';
  muscle: string | null;
  cues: string | null;
  imageUri: string | null;
  sortOrder: number;
  /** Template prescription (null for ad-hoc / no-template exercises). */
  templateExerciseId: number | null;
  targetSets: number | null;
  tempo: string | null;
  /** Resolved rest: per-day override → exercise default → null (caller falls back to settings). */
  restSeconds: number | null;
  sets: SessionSet[];
};

export async function getSessionExercises(
  sessionId: number,
  templateId: number | null = null
): Promise<SessionExerciseDetail[]> {
  const rows = await expoDb.getAllAsync<Omit<SessionExerciseDetail, 'sets' | 'isWarmup'>>(
    `SELECT se.id as sessionExerciseId, e.id as exerciseId, e.name as name,
            e.metric as metric, mg.name as muscle, e.cues as cues,
            e.image_uri as imageUri, se.sort_order as sortOrder,
            te.id as templateExerciseId, te.target_sets as targetSets, te.tempo as tempo,
            COALESCE(te.rest_seconds, e.rest_seconds) as restSeconds
     FROM session_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     LEFT JOIN exercise_muscles em ON em.exercise_id = e.id AND em.is_primary = 1
     LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
     LEFT JOIN template_exercises te ON te.template_id = ? AND te.exercise_id = e.id
     WHERE se.session_id = ?
     ORDER BY se.sort_order`,
    [templateId, sessionId]
  );
  const result: SessionExerciseDetail[] = [];
  for (const r of rows) {
    const s = await expoDb.getAllAsync<Omit<SessionSet, 'isWarmup'> & { isWarmup: number }>(
      `SELECT id, set_number as setNumber, weight, reps,
              duration_sec as durationSec, distance_m as distanceM, note,
              is_warmup as isWarmup
       FROM sets WHERE session_exercise_id = ? ORDER BY set_number`,
      [r.sessionExerciseId]
    );
    result.push({ ...r, sets: s.map((x) => ({ ...x, isWarmup: !!x.isWarmup })) });
  }
  return result;
}

export type SessionMobilityRow = MobilityRow & { checked: boolean };

export async function getSessionMobility(
  sessionId: number,
  templateId: number | null
): Promise<SessionMobilityRow[]> {
  if (templateId == null) return [];
  const rows = await expoDb.getAllAsync<MobilityRow & { checked: number | null }>(
    `SELECT mi.id as mobilityItemId, mi.name as name, mi.kind as kind,
            tm.target_reps as targetReps, tm.hold_seconds as holdSeconds,
            mi.body_part as bodyPart, mi.cues as cues, mi.image_uri as imageUri,
            mc.checked as checked
     FROM template_mobility tm
     JOIN mobility_items mi ON mi.id = tm.mobility_item_id
     LEFT JOIN mobility_checks mc
        ON mc.mobility_item_id = tm.mobility_item_id AND mc.session_id = ?
     WHERE tm.template_id = ?
     ORDER BY tm.sort_order`,
    [sessionId, templateId]
  );
  return rows.map((r) => ({ ...r, checked: !!r.checked }));
}

/** All sets ever logged for an exercise, oldest first, with the session time. */
export type HistorySet = {
  setId: number;
  sessionId: number;
  at: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

export async function allSetsForExercise(exerciseId: number): Promise<HistorySet[]> {
  return expoDb.getAllAsync<HistorySet>(
    `SELECT st.id as setId, se.session_id as sessionId, s.started_at as at,
            st.set_number as setNumber, st.weight as weight, st.reps as reps
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     WHERE se.exercise_id = ? AND COALESCE(st.is_warmup, 0) = 0
     ORDER BY s.started_at, st.set_number`,
    [exerciseId]
  );
}

export type LastSession = {
  /** When the previous session started (epoch ms), or null if none. */
  at: number | null;
  sets: { weight: number | null; reps: number | null }[];
};

/** Sets (+ date) from the most recent OTHER session that trained this exercise. */
export async function lastSessionSets(
  exerciseId: number,
  excludeSessionId: number
): Promise<LastSession> {
  const prev = await expoDb.getFirstAsync<{ sessionId: number; at: number }>(
    `SELECT se.session_id as sessionId, s.started_at as at
     FROM session_exercises se
     JOIN sessions s ON s.id = se.session_id
     JOIN sets st ON st.session_exercise_id = se.id
     WHERE se.exercise_id = ? AND se.session_id != ? AND COALESCE(st.is_warmup, 0) = 0
     GROUP BY se.session_id
     ORDER BY s.started_at DESC LIMIT 1`,
    [exerciseId, excludeSessionId]
  );
  if (!prev) return { at: null, sets: [] };
  const sets = await expoDb.getAllAsync<{ weight: number | null; reps: number | null }>(
    `SELECT st.weight as weight, st.reps as reps
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     WHERE se.exercise_id = ? AND se.session_id = ? AND COALESCE(st.is_warmup, 0) = 0
     ORDER BY st.set_number`,
    [exerciseId, prev.sessionId]
  );
  return { at: prev.at, sets };
}

// ---- session mutations ----

export async function addSet(
  sessionExerciseId: number,
  values: Partial<
    Pick<SessionSet, 'weight' | 'reps' | 'durationSec' | 'distanceM' | 'note' | 'isWarmup'>
  >
): Promise<number> {
  const prev = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(set_number), 0) as n FROM sets WHERE session_exercise_id = ?`,
    [sessionExerciseId]
  );
  const [row] = await db
    .insert(sets)
    .values({
      sessionExerciseId,
      setNumber: (prev?.n ?? 0) + 1,
      weight: values.weight ?? null,
      reps: values.reps ?? null,
      durationSec: values.durationSec ?? null,
      distanceM: values.distanceM ?? null,
      note: values.note ?? null,
      isWarmup: values.isWarmup ?? false,
    })
    .returning({ id: sets.id });
  return row.id;
}

export async function updateSet(
  setId: number,
  patch: Partial<Pick<SessionSet, 'weight' | 'reps' | 'durationSec' | 'distanceM' | 'note'>>
): Promise<void> {
  await db.update(sets).set(patch).where(eq(sets.id, setId));
}

export async function deleteSet(setId: number): Promise<void> {
  await db.delete(sets).where(eq(sets.id, setId));
}

export async function addExerciseToSession(
  sessionId: number,
  exerciseId: number
): Promise<void> {
  const prev = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) as n FROM session_exercises WHERE session_id = ?`,
    [sessionId]
  );
  await db
    .insert(sessionExercises)
    .values({ sessionId, exerciseId, sortOrder: (prev?.n ?? -1) + 1 });
}

export async function removeSessionExercise(sessionExerciseId: number): Promise<void> {
  await db.delete(sessionExercises).where(eq(sessionExercises.id, sessionExerciseId));
}

export async function toggleMobility(
  sessionId: number,
  mobilityItemId: number,
  checked: boolean
): Promise<void> {
  const existing = await db
    .select()
    .from(mobilityChecks)
    .where(
      and(
        eq(mobilityChecks.sessionId, sessionId),
        eq(mobilityChecks.mobilityItemId, mobilityItemId)
      )
    );
  if (existing.length > 0) {
    await db
      .update(mobilityChecks)
      .set({ checked })
      .where(eq(mobilityChecks.id, existing[0].id));
  } else {
    await db.insert(mobilityChecks).values({ sessionId, mobilityItemId, checked });
  }
}

export async function finishSession(sessionId: number): Promise<void> {
  await db
    .update(sessions)
    .set({ finishedAt: Date.now() })
    .where(eq(sessions.id, sessionId));
}

export async function setSessionPhase(sessionId: number, phase: Phase): Promise<void> {
  await db.update(sessions).set({ phase }).where(eq(sessions.id, sessionId));
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// ---------------------------------------------------------------------------
// History + progress
// ---------------------------------------------------------------------------

export type SessionSummary = {
  id: number;
  dayName: string;
  phase: Phase;
  startedAt: number;
  finishedAt: number | null;
  volume: number;
  setCount: number;
};

export async function listSessions(): Promise<SessionSummary[]> {
  return expoDb.getAllAsync<SessionSummary>(
    `SELECT s.id, s.day_name as dayName, s.phase, s.started_at as startedAt,
            s.finished_at as finishedAt,
            COALESCE(SUM(st.weight * st.reps), 0) as volume,
            COUNT(st.id) as setCount
     FROM sessions s
     LEFT JOIN session_exercises se ON se.session_id = s.id
     LEFT JOIN sets st ON st.session_exercise_id = se.id AND COALESCE(st.is_warmup, 0) = 0
     GROUP BY s.id
     ORDER BY s.started_at DESC`
  );
}

export type WeekWorkout = {
  id: number;
  dayName: string;
  startedAt: number;
  finishedAt: number;
};

/** Finished workouts started within [startMs, endMs), newest first. */
export async function workoutsThisWeek(
  startMs: number,
  endMs: number
): Promise<WeekWorkout[]> {
  return expoDb.getAllAsync<WeekWorkout>(
    `SELECT id, day_name as dayName, started_at as startedAt, finished_at as finishedAt
     FROM sessions
     WHERE finished_at IS NOT NULL AND started_at >= ? AND started_at < ?
     ORDER BY started_at DESC`,
    [startMs, endMs]
  );
}

/** All working sets in a time window with their primary muscle, for weekly stats. */
export type MuscleSet = {
  weight: number | null;
  reps: number | null;
  muscle: string | null;
  at: number;
};

export async function setsInRange(startMs: number, endMs: number): Promise<MuscleSet[]> {
  return expoDb.getAllAsync<MuscleSet>(
    `SELECT st.weight as weight, st.reps as reps, mg.name as muscle, s.started_at as at
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     LEFT JOIN exercise_muscles em ON em.exercise_id = se.exercise_id AND em.is_primary = 1
     LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
     WHERE s.started_at >= ? AND s.started_at < ? AND COALESCE(st.is_warmup, 0) = 0`,
    [startMs, endMs]
  );
}

/** Every working set with time + primary muscle (for the volume trend). */
export async function allMuscleSets(): Promise<MuscleSet[]> {
  return expoDb.getAllAsync<MuscleSet>(
    `SELECT st.weight as weight, st.reps as reps, mg.name as muscle, s.started_at as at
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     LEFT JOIN exercise_muscles em ON em.exercise_id = se.exercise_id AND em.is_primary = 1
     LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
     WHERE COALESCE(st.is_warmup, 0) = 0`
  );
}

/** Every logged set with its exercise + session time, for PR-log computation. */
export type ExerciseSetRow = {
  exerciseId: number;
  exerciseName: string;
  at: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

export async function allSetsWithExercise(): Promise<ExerciseSetRow[]> {
  return expoDb.getAllAsync<ExerciseSetRow>(
    `SELECT se.exercise_id as exerciseId, e.name as exerciseName, s.started_at as at,
            st.set_number as setNumber, st.weight as weight, st.reps as reps
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN exercises e ON e.id = se.exercise_id
     JOIN sessions s ON s.id = se.session_id
     WHERE COALESCE(st.is_warmup, 0) = 0
     ORDER BY s.started_at, st.set_number`
  );
}

export type ExerciseRow = {
  id: number;
  name: string;
  metric: 'weight_reps' | 'cardio';
  isActive: number;
  muscle: string | null;
  muscleGroupId: number | null;
  cues: string | null;
  imageUri: string | null;
  restSeconds: number | null;
};

export async function listExercises(): Promise<ExerciseRow[]> {
  return expoDb.getAllAsync<ExerciseRow>(
    `SELECT e.id, e.name, e.metric, e.is_active as isActive,
            mg.name as muscle, mg.id as muscleGroupId, e.cues as cues,
            e.image_uri as imageUri, e.rest_seconds as restSeconds
     FROM exercises e
     LEFT JOIN exercise_muscles em ON em.exercise_id = e.id AND em.is_primary = 1
     LEFT JOIN muscle_groups mg ON mg.id = em.muscle_group_id
     ORDER BY e.name`
  );
}

export type MuscleGroupRow = { id: number; name: string };

export async function listMuscleGroups(): Promise<MuscleGroupRow[]> {
  return expoDb.getAllAsync<MuscleGroupRow>(
    `SELECT id, name FROM muscle_groups ORDER BY name`
  );
}

export async function setPrimaryMuscle(
  exerciseId: number,
  muscleGroupId: number
): Promise<void> {
  await expoDb.runAsync(`DELETE FROM exercise_muscles WHERE exercise_id = ? AND is_primary = 1`, [
    exerciseId,
  ]);
  await expoDb.runAsync(
    `INSERT INTO exercise_muscles (exercise_id, muscle_group_id, is_primary) VALUES (?, ?, 1)`,
    [exerciseId, muscleGroupId]
  );
}

/** Set (or clear) the free-text form cues for an exercise. Empty → null. */
export async function setExerciseCues(
  exerciseId: number,
  cues: string | null
): Promise<void> {
  const trimmed = cues?.trim();
  await db
    .update(exercises)
    .set({ cues: trimmed ? trimmed : null })
    .where(eq(exercises.id, exerciseId));
}

export async function renameExercise(exerciseId: number, name: string): Promise<void> {
  await db.update(exercises).set({ name: name.trim() }).where(eq(exercises.id, exerciseId));
}

export async function setExerciseMetric(
  exerciseId: number,
  metric: 'weight_reps' | 'cardio'
): Promise<void> {
  await db.update(exercises).set({ metric }).where(eq(exercises.id, exerciseId));
}

export async function setExerciseActive(
  exerciseId: number,
  isActive: boolean
): Promise<void> {
  await db.update(exercises).set({ isActive }).where(eq(exercises.id, exerciseId));
}

export async function setExerciseRest(
  exerciseId: number,
  restSeconds: number | null
): Promise<void> {
  await db.update(exercises).set({ restSeconds }).where(eq(exercises.id, exerciseId));
}

export async function setExerciseImage(
  exerciseId: number,
  uri: string | null
): Promise<void> {
  await db.update(exercises).set({ imageUri: uri }).where(eq(exercises.id, exerciseId));
}

/** Create a catalog exercise; optionally link a primary muscle. Returns the id. */
export async function createExercise(input: {
  name: string;
  metric: 'weight_reps' | 'cardio';
  muscleGroupId?: number | null;
}): Promise<number> {
  const [row] = await db
    .insert(exercises)
    .values({ name: input.name.trim(), metric: input.metric })
    .returning({ id: exercises.id });
  if (input.muscleGroupId != null) {
    await db.insert(exerciseMuscles).values({
      exerciseId: row.id,
      muscleGroupId: input.muscleGroupId,
      isPrimary: true,
    });
  }
  return row.id;
}

/** How many logged sessions reference this exercise (for delete warnings). */
export async function exerciseSessionCount(exerciseId: number): Promise<number> {
  const row = await expoDb.getFirstAsync<{ n: number }>(
    `SELECT COUNT(DISTINCT session_id) as n FROM session_exercises WHERE exercise_id = ?`,
    [exerciseId]
  );
  return row?.n ?? 0;
}

/** Delete an exercise. Cascades to template_exercises and session_exercises→sets. */
export async function deleteExercise(exerciseId: number): Promise<void> {
  await db.delete(exercises).where(eq(exercises.id, exerciseId));
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export type PhotoRow = {
  id: number;
  weekStart: string;
  uri: string;
  takenAt: number;
  note: string | null;
};

export async function listPhotos(): Promise<PhotoRow[]> {
  return expoDb.getAllAsync<PhotoRow>(
    `SELECT id, week_start as weekStart, uri, taken_at as takenAt, note
     FROM photos ORDER BY week_start DESC, taken_at DESC`
  );
}

export async function photoForWeek(weekStartISO: string): Promise<PhotoRow | null> {
  return expoDb.getFirstAsync<PhotoRow>(
    `SELECT id, week_start as weekStart, uri, taken_at as takenAt, note
     FROM photos WHERE week_start = ? ORDER BY taken_at DESC LIMIT 1`,
    [weekStartISO]
  );
}

export async function addPhoto(weekStartISO: string, uri: string): Promise<void> {
  await db.insert(photos).values({ weekStart: weekStartISO, uri, takenAt: Date.now() });
}

export async function deletePhoto(id: number): Promise<void> {
  await db.delete(photos).where(eq(photos.id, id));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type SettingsRow = {
  id: number;
  notificationsEnabled: number;
  notificationDay: number;
  notificationHour: number;
  notificationMinute: number;
  restSeconds: number;
  restSoundEnabled: number;
  deloadCycleStart: string;
};

export async function getSettings(): Promise<SettingsRow | null> {
  return expoDb.getFirstAsync<SettingsRow>(
    `SELECT id, notifications_enabled as notificationsEnabled,
            notification_day as notificationDay, notification_hour as notificationHour,
            notification_minute as notificationMinute, rest_seconds as restSeconds,
            rest_sound_enabled as restSoundEnabled, deload_cycle_start as deloadCycleStart
     FROM settings WHERE id = 1`
  );
}

export async function updateSettings(
  patch: Partial<{
    notificationsEnabled: boolean;
    notificationDay: number;
    notificationHour: number;
    notificationMinute: number;
    restSeconds: number;
    restSoundEnabled: boolean;
    deloadCycleStart: string;
  }>
): Promise<void> {
  await db.update(settingsTable).set(patch).where(eq(settingsTable.id, 1));
}
