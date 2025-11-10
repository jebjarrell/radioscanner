import BetterSqlite from 'better-sqlite3';

type SqliteDatabase = BetterSqlite.Database;

type RecentSignalRow = {
  ts: number;
  frequency: number;
  signalStrength: number;
  bandwidth: number;
};

export class SignalDatabase {
  private readonly insertStmt: BetterSqlite.Statement;
  private readonly deleteOldStmt: BetterSqlite.Statement;
  private readonly recentStmt: BetterSqlite.Statement;
  private readonly exportStmt: BetterSqlite.Statement;

  constructor(private readonly db: SqliteDatabase) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        frequency REAL NOT NULL,
        signalStrength REAL NOT NULL,
        bandwidth REAL NOT NULL,
        deviceLat REAL,
        deviceLon REAL
      );
      CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts);
      CREATE INDEX IF NOT EXISTS idx_signals_freq ON signals(frequency);
    `);

    this.insertStmt = this.db.prepare(`
      INSERT INTO signals (ts, frequency, signalStrength, bandwidth, deviceLat, deviceLon)
      VALUES (?, ?, ?, ?, NULL, NULL)
    `);

    this.deleteOldStmt = this.db.prepare(`DELETE FROM signals WHERE ts < ?`);
    this.recentStmt = this.db.prepare(`
      SELECT ts, frequency, signalStrength, bandwidth
      FROM signals
      ORDER BY ts DESC
      LIMIT ?
    `);
    this.exportStmt = this.db.prepare(`
      SELECT ts, frequency, signalStrength, bandwidth
      FROM signals
      WHERE (? IS NULL OR ts >= ?)
        AND (? IS NULL OR ts <= ?)
      ORDER BY ts DESC
    `);
  }

  insertPeak(ts: number, frequencyMHz: number, dBfs: number, bandwidthHz: number): void {
    this.insertStmt.run(ts, frequencyMHz, dBfs, bandwidthHz);
    const ttl = Date.now() - 60 * 60 * 1000;
    this.deleteOldStmt.run(ttl);
  }

  getRecent(limit = 200): RecentSignalRow[] {
    return this.recentStmt.all(limit) as RecentSignalRow[];
  }

  getCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM signals`).get() as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  }

  exportToCsv(start?: number, end?: number): string {
    const rows = this.exportStmt.all(
      start ?? null,
      start ?? null,
      end ?? null,
      end ?? null,
    ) as RecentSignalRow[];
    const header = 'TimestampISO,FrequencyMHz,SignalStrength_dBFS,Bandwidth_Hz\n';
    const lines = rows.map(
      (row) =>
        `${new Date(row.ts).toISOString()},${row.frequency},${row.signalStrength},${row.bandwidth}`,
    );
    return header + lines.join('\n');
  }
}
