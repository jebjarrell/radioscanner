import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AircraftDatabase } from './aircraftDb.js';
import type { AircraftRecord } from './validation.js';

const record = (overrides: Partial<AircraftRecord> = {}): AircraftRecord => ({
  ts: Date.now(),
  icao: 'abc123',
  callsign: 'TEST1',
  lat: 40,
  lon: -73,
  altitude: 10_000,
  speed: 400,
  heading: 90,
  verticalRate: 0,
  squawk: '1200',
  ...overrides,
});

describe('AircraftDatabase', () => {
  let raw: BetterSqlite3.Database;
  let db: AircraftDatabase;

  beforeEach(() => {
    raw = new BetterSqlite3(':memory:');
    db = new AircraftDatabase(raw);
  });

  afterEach(() => {
    raw.close();
  });

  it('starts empty', () => {
    expect(db.getCount()).toBe(0);
  });

  it('inserts a batch and counts unique records', () => {
    db.insertBatch([record({ icao: 'aaa111' }), record({ icao: 'bbb222' })]);
    expect(db.getCount()).toBe(2);
  });

  it('upserts on conflicting ICAO instead of duplicating', () => {
    db.insertBatch([record({ icao: 'aaa111', callsign: 'OLD', ts: 1 })]);
    db.insertBatch([record({ icao: 'aaa111', callsign: 'NEW', ts: 2 })]);
    expect(db.getCount()).toBe(1);
    expect(db.getRecent(10)[0].callsign).toBe('NEW');
  });

  it('returns recent records ordered by last_seen descending', () => {
    db.insertBatch([
      record({ icao: 'aaa111', ts: 100 }),
      record({ icao: 'bbb222', ts: 300 }),
      record({ icao: 'ccc333', ts: 200 }),
    ]);
    const recent = db.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].icao).toBe('bbb222');
    expect(recent[1].icao).toBe('ccc333');
  });

  it('ignores empty batches', () => {
    db.insertBatch([]);
    expect(db.getCount()).toBe(0);
  });

  it('exports records as CSV with a header row', () => {
    db.insertBatch([record({ icao: 'aaa111', callsign: 'CSV1', ts: 1_700_000_000_000 })]);
    const csv = db.exportToCsv();
    expect(csv).toContain('ICAO,Callsign,Altitude,Speed,Heading,Latitude,Longitude,LastSeen');
    expect(csv).toContain('aaa111');
    expect(csv).toContain('CSV1');
  });

  it('filters CSV export by time range', () => {
    db.insertBatch([record({ icao: 'aaa111', ts: 1_000 }), record({ icao: 'bbb222', ts: 5_000 })]);
    const csv = db.exportToCsv(4_000, 6_000);
    expect(csv).toContain('bbb222');
    expect(csv).not.toContain('aaa111');
  });
});
