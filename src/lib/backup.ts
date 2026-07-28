import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';

import { expoDb } from '@/db/client';

const BACKUP_VERSION = 1;

// Parent → child order. Restore inserts in this order; wipe deletes in reverse.
const TABLES = [
  'muscle_groups',
  'exercises',
  'exercise_muscles',
  'day_templates',
  'template_exercises',
  'mobility_items',
  'template_mobility',
  'sessions',
  'session_exercises',
  'sets',
  'mobility_checks',
  'photos',
  'settings',
] as const;

type Snapshot = {
  app: 'FitDiaries';
  version: number;
  exportedAt: number;
  data: Record<string, Record<string, unknown>[]>;
};

/** Read every table into a plain-JSON snapshot of all app data. */
export async function buildSnapshot(): Promise<Snapshot> {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    data[t] = await expoDb.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  }
  return { app: 'FitDiaries', version: BACKUP_VERSION, exportedAt: Date.now(), data };
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Write a backup file to the cache dir; returns its uri + session count. */
export async function exportBackup(): Promise<{ uri: string; sessions: number }> {
  const snap = await buildSnapshot();
  const uri = `${cacheDirectory}fitdiaries-backup-${stamp()}.json`;
  await writeAsStringAsync(uri, JSON.stringify(snap));
  return { uri, sessions: snap.data.sessions?.length ?? 0 };
}

/** Export then open the share sheet so the file can be saved/sent. */
export async function shareBackup(): Promise<number> {
  const { uri, sessions } = await exportBackup();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'FitDiaries backup',
      UTI: 'public.json',
    });
  }
  return sessions;
}

export type ImportResult =
  | { imported: true; sessions: number }
  | { imported: false; cancelled?: boolean; error?: string };

/** Pick a backup JSON and replace all app data with it. Destructive. */
export async function importBackup(): Promise<ImportResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/*', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return { imported: false, cancelled: true };

  let parsed: Snapshot;
  try {
    const content = await readAsStringAsync(res.assets[0].uri);
    parsed = JSON.parse(content);
  } catch {
    return { imported: false, error: 'Could not read the file as JSON.' };
  }
  if (parsed?.app !== 'FitDiaries' || !parsed.data) {
    return { imported: false, error: 'This is not a FitDiaries backup file.' };
  }

  await restoreSnapshot(parsed.data);
  return { imported: true, sessions: parsed.data.sessions?.length ?? 0 };
}

/** Wipe every table and reinsert rows from the snapshot, preserving ids. */
async function restoreSnapshot(data: Snapshot['data']): Promise<void> {
  // FK pragma must be toggled outside a transaction.
  await expoDb.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await expoDb.execAsync('BEGIN');
    for (const t of [...TABLES].reverse()) {
      await expoDb.runAsync(`DELETE FROM ${t}`);
    }
    for (const t of TABLES) {
      for (const row of data[t] ?? []) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(', ');
        await expoDb.runAsync(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map((c) => row[c] as never)
        );
      }
    }
    await expoDb.execAsync('COMMIT');
  } catch (e) {
    await expoDb.execAsync('ROLLBACK');
    throw e;
  } finally {
    await expoDb.execAsync('PRAGMA foreign_keys = ON');
  }
}
