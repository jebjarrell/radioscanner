import BetterSqlite3 from 'better-sqlite3';

import type { DroneRecord } from './validation.js';

const MAX_RECORDS = 100;

export class DroneDatabase {
  private readonly insertStmt: BetterSqlite3.Statement<DroneRecord>;

  constructor(private readonly db: BetterSqlite3.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS drones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drone_id TEXT UNIQUE NOT NULL,
        manufacturer TEXT,
        model TEXT,
        drone_lat REAL,
        drone_lon REAL,
        drone_altitude REAL,
        operator_lat REAL,
        operator_lon REAL,
        speed REAL,
        heading REAL,
        last_seen INTEGER,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE INDEX IF NOT EXISTS idx_drones_last_seen ON drones(last_seen);
    `);
    this.insertStmt = this.db.prepare(`
      INSERT INTO drones (
        drone_id, manufacturer, model, drone_lat, drone_lon, drone_altitude,
        operator_lat, operator_lon, speed, heading, last_seen
      )
      VALUES (
        @droneId, @manufacturer, @model, @droneLat, @droneLon, @droneAltitude,
        @operatorLat, @operatorLon, @speed, @heading, @ts
      )
      ON CONFLICT(drone_id) DO UPDATE SET
        manufacturer=excluded.manufacturer,
        model=excluded.model,
        drone_lat=excluded.drone_lat,
        drone_lon=excluded.drone_lon,
        drone_altitude=excluded.drone_altitude,
        operator_lat=excluded.operator_lat,
        operator_lon=excluded.operator_lon,
        speed=excluded.speed,
        heading=excluded.heading,
        last_seen=excluded.last_seen
    `);
  }

  insertBatch(records: DroneRecord[]): void {
    if (!records.length) {
      return;
    }
    try {
      const tx = this.db.transaction((rows: DroneRecord[]) => {
        for (const record of rows) {
          this.insertStmt.run(record);
        }
        this.db.exec(`
          DELETE FROM drones
          WHERE id NOT IN (
            SELECT id FROM drones
            ORDER BY last_seen DESC
            LIMIT ${MAX_RECORDS}
          )
        `);
      });
      tx(records);
    } catch (error) {
      console.error('Failed to insert drone batch:', { count: records.length }, error);
      // Non-critical: don't throw, allow telemetry to continue
    }
  }

  getCount(): number {
    try {
      const row = this.db.prepare(`SELECT COUNT(*) as count FROM drones`).get() as {
        count: number;
      };
      return row?.count ?? 0;
    } catch (error) {
      console.error('Failed to get drone count:', error);
      return 0;
    }
  }
}
