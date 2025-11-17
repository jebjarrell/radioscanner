import BetterSqlite3 from 'better-sqlite3';

import type { AircraftRecord } from './validation.js';

const MAX_RECORDS = 500;

const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export class AircraftDatabase {
  private readonly insertStmt: BetterSqlite3.Statement<AircraftRecord>;

  constructor(private readonly db: BetterSqlite3.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS aircraft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao TEXT UNIQUE NOT NULL,
        callsign TEXT,
        altitude INTEGER,
        speed INTEGER,
        heading INTEGER,
        lat REAL,
        lon REAL,
        vertical_rate INTEGER,
        squawk TEXT,
        last_seen INTEGER,
        created_at INTEGER DEFAULT (strftime('%s','now')*1000)
      );
      CREATE INDEX IF NOT EXISTS idx_aircraft_icao ON aircraft(icao);
      CREATE INDEX IF NOT EXISTS idx_aircraft_last_seen ON aircraft(last_seen);
    `);
    this.insertStmt = this.db.prepare(`
      INSERT INTO aircraft (icao, callsign, altitude, speed, heading, lat, lon, vertical_rate, squawk, last_seen)
      VALUES (@icao, @callsign, @altitude, @speed, @heading, @lat, @lon, @verticalRate, @squawk, @ts)
      ON CONFLICT(icao) DO UPDATE SET
        callsign=excluded.callsign,
        altitude=excluded.altitude,
        speed=excluded.speed,
        heading=excluded.heading,
        lat=excluded.lat,
        lon=excluded.lon,
        vertical_rate=excluded.vertical_rate,
        squawk=excluded.squawk,
        last_seen=excluded.last_seen
    `);
  }

  insertBatch(records: AircraftRecord[]): void {
    if (!records.length) {
      return;
    }
    try {
      const tx = this.db.transaction((rows: AircraftRecord[]) => {
        for (const record of rows) {
          this.insertStmt.run(record);
        }
        this.db.exec(`
          DELETE FROM aircraft
          WHERE id NOT IN (
            SELECT id FROM aircraft
            ORDER BY last_seen DESC
            LIMIT ${MAX_RECORDS}
          )
        `);
      });
      tx(records);
    } catch (error) {
      console.error('Failed to insert aircraft batch:', { count: records.length }, error);
      // Non-critical: don't throw, allow telemetry to continue
    }
  }

  getCount(): number {
    try {
      const row = this.db.prepare(`SELECT COUNT(*) as count FROM aircraft`).get() as {
        count: number;
      };
      return row?.count ?? 0;
    } catch (error) {
      console.error('Failed to get aircraft count:', error);
      return 0;
    }
  }

  getRecent(limit: number = 200): Array<{
    icao: string;
    callsign: string | null;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    lat: number | null;
    lon: number | null;
    vertical_rate: number | null;
    squawk: string | null;
    last_seen: number;
  }> {
    return this.db
      .prepare(
        `
      SELECT icao, callsign, altitude, speed, heading, lat, lon, vertical_rate, squawk, last_seen
      FROM aircraft
      ORDER BY last_seen DESC
      LIMIT ?
    `,
      )
      .all(limit) as Array<{
      icao: string;
      callsign: string | null;
      altitude: number | null;
      speed: number | null;
      heading: number | null;
      lat: number | null;
      lon: number | null;
      vertical_rate: number | null;
      squawk: string | null;
      last_seen: number;
    }>;
  }

  exportToCsv(start?: number, end?: number): string {
    try {
      const rows = this.db
        .prepare(
          `
        SELECT icao, callsign, altitude, speed, heading, lat, lon, last_seen
        FROM aircraft
        WHERE (? IS NULL OR last_seen >= ?)
          AND (? IS NULL OR last_seen <= ?)
        ORDER BY last_seen DESC
      `,
        )
        .all(start ?? null, start ?? null, end ?? null, end ?? null) as Array<{
        icao: string;
        callsign: string | null;
        altitude: number | null;
        speed: number | null;
        heading: number | null;
        lat: number | null;
        lon: number | null;
        last_seen: number;
      }>;

      const header = 'ICAO,Callsign,Altitude,Speed,Heading,Latitude,Longitude,LastSeen\n';
      const body = rows
        .map((row) =>
          [
            csvEscape(row.icao),
            csvEscape(row.callsign),
            csvEscape(row.altitude),
            csvEscape(row.speed),
            csvEscape(row.heading),
            csvEscape(row.lat),
            csvEscape(row.lon),
            csvEscape(new Date(row.last_seen).toISOString()),
          ].join(','),
        )
        .join('\n');

      return `${header}${body}${body ? '\n' : ''}`;
    } catch (error) {
      console.error('Failed to export aircraft to CSV:', error);
      throw new Error(
        `Aircraft export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
