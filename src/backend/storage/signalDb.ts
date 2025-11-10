import BetterSqlite3 from 'better-sqlite3';

type SqliteDatabase = BetterSqlite3.Database;

type RecentSignalRow = {
  ts: number;
  frequency: number;
  signalStrength: number;
  bandwidth: number;
};

export class SignalDatabase {
  private readonly insertStmt: BetterSqlite3.Statement;
  private readonly deleteOldStmt: BetterSqlite3.Statement;
  private readonly recentStmt: BetterSqlite3.Statement;
  private readonly exportStmt: BetterSqlite3.Statement;

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
    try {
      this.insertStmt.run(ts, frequencyMHz, dBfs, bandwidthHz);
      const ttl = Date.now() - 60 * 60 * 1000;
      this.deleteOldStmt.run(ttl);
    } catch (error) {
      console.error(
        'Failed to insert signal peak:',
        { ts, frequencyMHz, dBfs, bandwidthHz },
        error,
      );
      // Non-critical: don't throw, allow scanning to continue
    }
  }

  getRecent(limit = 200): RecentSignalRow[] {
    try {
      return this.recentStmt.all(limit) as RecentSignalRow[];
    } catch (error) {
      console.error('Failed to fetch recent signals:', { limit }, error);
      return [];
    }
  }

  getCount(): number {
    try {
      const row = this.db.prepare(`SELECT COUNT(*) as count FROM signals`).get() as
        | { count: number }
        | undefined;
      return row?.count ?? 0;
    } catch (error) {
      console.error('Failed to get signal count:', error);
      return 0;
    }
  }

  exportToCsv(start?: number, end?: number): string {
    try {
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
    } catch (error) {
      console.error('Failed to export signals to CSV:', error);
      throw new Error(
        `Signal export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
