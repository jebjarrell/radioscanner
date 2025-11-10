import Database from 'better-sqlite3';

export class SettingsDatabase {
  private readonly upsertStmt: Database.Statement<[string, string, number]>;

  constructor(private readonly db: Database.Database) {
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
    `);

    const insertDefault = this.db.prepare(
      `INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES (?, ?, strftime('%s','now')*1000)`,
    );

    const defaults: Array<[string, string]> = [
      ['distance_unit', 'miles'],
      ['default_band', 'airband'],
      ['map_zoom', '10'],
      ['map_center_lat', '37.7749'],
      ['map_center_lon', '-122.4194'],
    ];

    const insertTx = this.db.transaction((rows: Array<[string, string]>) => {
      for (const [key, value] of rows) {
        insertDefault.run(key, value);
      }
    });
    insertTx(defaults);

    this.upsertStmt = this.db.prepare(
      `INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)`,
    );
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare(`SELECT key, value FROM user_settings`).all() as Array<{
      key: string;
      value: string;
    }>;
    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  set(key: string, value: string): void {
    this.upsertStmt.run(key, value, Date.now());
  }

  close(): void {
    this.db.close();
  }
}
