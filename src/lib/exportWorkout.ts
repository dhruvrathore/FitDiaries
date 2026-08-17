import { Share } from 'react-native';

import {
  getSessionExercises,
  getSessionHeader,
  getSessionMobility,
  listSessions,
} from '@/db/queries';
import { kg, setLabel } from '@/lib/format';
import { totalVolume } from '@/lib/metrics';
import { mondayOf, shortDate, weekLabel } from '@/lib/week';
import { phaseLabel } from '@/theme/theme';

/** Readable lines for a single session (no app header), or null if it doesn't exist. */
async function sessionLines(sessionId: number): Promise<string[] | null> {
  const header = await getSessionHeader(sessionId);
  if (!header) return null;

  const [exercises, mobility] = await Promise.all([
    getSessionExercises(sessionId, header.templateId),
    getSessionMobility(sessionId, header.templateId),
  ]);

  const workingSets = exercises.flatMap((e) => e.sets).filter((s) => !s.isWarmup);
  const volume = totalVolume(workingSets);

  const lines: string[] = [];
  lines.push(`${header.dayName} — ${phaseLabel[header.phase]}`);
  lines.push(shortDate(new Date(header.startedAt)));
  if (header.bodyWeight != null) lines.push(`Body weight: ${kg(header.bodyWeight)} kg`);
  lines.push(`Volume: ${Math.round(volume)} kg · ${workingSets.length} working sets`);
  lines.push('');

  for (const ex of exercises) {
    lines.push(ex.muscle ? `${ex.name} (${ex.muscle})` : ex.name);
    if (ex.sets.length === 0) {
      lines.push('  no sets logged');
    } else {
      for (const s of ex.sets) {
        const value =
          ex.metric === 'cardio'
            ? [
                s.durationSec ? `${Math.round(s.durationSec / 60)} min` : null,
                s.distanceM ? `${s.distanceM} m` : null,
              ]
                .filter(Boolean)
                .join(' ') || '–'
            : setLabel(s.weight, s.reps);
        lines.push(`  Set ${s.setNumber}${s.isWarmup ? ' (warm-up)' : ''}: ${value}`);
      }
    }
    lines.push('');
  }

  if (mobility.length > 0) {
    const checked = mobility.filter((m) => m.checked).length;
    lines.push(`Mobility: ${checked}/${mobility.length} completed`);
  }

  return lines;
}

/** Full readable summary of one session, ready to share. Null if not found. */
export async function buildSessionText(sessionId: number): Promise<string | null> {
  const lines = await sessionLines(sessionId);
  if (!lines) return null;
  return ['FitDiaries workout', '', ...lines].join('\n').trim();
}

/** Full readable summary of every session in the week containing `mondayMs`. */
export async function buildWeekText(mondayMs: number): Promise<string> {
  const monday = mondayOf(new Date(mondayMs));
  const all = await listSessions();
  const week = all
    .filter((s) => mondayOf(new Date(s.startedAt)).getTime() === monday.getTime())
    .sort((a, b) => a.startedAt - b.startedAt);

  const totalVol = week.reduce((sum, s) => sum + s.volume, 0);
  const totalSets = week.reduce((sum, s) => sum + s.setCount, 0);

  const out: string[] = [
    `FitDiaries — week of ${weekLabel(monday)}`,
    `${week.length} ${week.length === 1 ? 'workout' : 'workouts'} · ${Math.round(
      totalVol
    )} kg volume · ${totalSets} working sets`,
  ];

  for (const s of week) {
    out.push('', '────────────', '');
    const lines = await sessionLines(s.id);
    if (lines) out.push(...lines);
  }

  return out.join('\n').trim();
}

/** Open the native share sheet with the given text (send, copy, or save). */
export async function shareText(message: string, title: string): Promise<void> {
  await Share.share({ message, title }, { dialogTitle: title, subject: title });
}
