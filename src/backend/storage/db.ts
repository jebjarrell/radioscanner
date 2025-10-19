import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const ensureDir = (p: string) => {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
};

const SESSION_DB_FILE = process.env.SESSION_DB_FILE || ':memory:';
const SETTINGS_DB_FILE =
  process.env.SETTINGS_DB_FILE || path.join('.', 'data', 'settings.sqlite');

if (SESSION_DB_FILE !== ':memory:') {
  ensureDir(path.dirname(path.resolve(SESSION_DB_FILE)));
}
ensureDir(path.dirname(path.resolve(SETTINGS_DB_FILE)));

export const sessionDb = new Database(SESSION_DB_FILE);
export const settingsDb = new Database(SETTINGS_DB_FILE);

console.log(`[db] session=${SESSION_DB_FILE} settings=${SETTINGS_DB_FILE}`);
