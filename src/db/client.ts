import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

import * as schema from './schema';

export const DB_NAME = 'fitdiaries.db';

// enableChangeListener powers drizzle's useLiveQuery so screens react to writes.
export const expoDb = SQLite.openDatabaseSync(DB_NAME, {
  enableChangeListener: true,
});

// Enforce foreign keys (cascades on delete) — off by default in SQLite.
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

export type DB = typeof db;
export { schema };
