import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const ensureDir = (p: string) => {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
};

const SETTINGS_DB_FILE =
  process.env.SETTINGS_DB_FILE || path.join('.', 'data', 'settings.sqlite');
ensureDir(path.dirname(path.resolve(SETTINGS_DB_FILE)));

const settingsDb = new Database(SETTINGS_DB_FILE);
settingsDb.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
  );
`);

const resolveSessionDbPath = (): string => {
  if (process.env.SESSION_DB_FILE) {
    return process.env.SESSION_DB_FILE;
  }
  try {
    const row = settingsDb
      .prepare(`SELECT value FROM user_settings WHERE key = ?`)
      .get('session_storage_mode') as { value: string } | undefined;
    const mode = row?.value === 'disk' ? 'disk' : 'memory';
    if (mode === 'disk') {
      const defaultPath = path.join('.', 'data', 'session.sqlite');
      ensureDir(path.dirname(path.resolve(defaultPath)));
      return defaultPath;
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[db] failed to read session storage mode', err);
    }
  }
  return ':memory:';
};

const SESSION_DB_FILE = resolveSessionDbPath();
if (SESSION_DB_FILE !== ':memory:') {
  ensureDir(path.dirname(path.resolve(SESSION_DB_FILE)));
}

export const sessionDb = new Database(SESSION_DB_FILE);
export { settingsDb };

console.log(`[db] session=${SESSION_DB_FILE} settings=${SETTINGS_DB_FILE}`);
