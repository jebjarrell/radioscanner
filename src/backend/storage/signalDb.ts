import Database from 'better-sqlite3';

import type { SignalRecord } from './validation.js';

const MAX_RECORDS = 1_000;

export class SignalDatabase {
  private readonly insertStmt: Database.Statement<SignalRecord>;

  constructor(private readonly db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        frequency REAL,
        signal_strength REAL,
        bandwidth REAL,
        device_lat REAL,
        device_lon REAL,
        ts INTEGER,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts);
    `);
    this.insertStmt = this.db.prepare(`
      INSERT INTO signals (frequency, signal_strength, bandwidth, device_lat, device_lon, ts)
      VALUES (@frequency, @signalStrength, @bandwidth, @deviceLat, @deviceLon, @ts)
    `);
  }

  insertBatch(records: SignalRecord[]): void {
    if (!records.length) {
      return;
    }
    const tx = this.db.transaction((rows: SignalRecord[]) => {
      for (const record of rows) {
        this.insertStmt.run(record);
      }
      this.db.exec(`
        DELETE FROM signals
        WHERE id NOT IN (
          SELECT id FROM signals
          ORDER BY ts DESC
          LIMIT ${MAX_RECORDS}
        )
      `);
    });
    tx(records);
  }

  getCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM signals`).get() as { count: number };
    return row?.count ?? 0;
  }
}
