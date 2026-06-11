import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DroneDatabase } from './droneDb.js';
import type { DroneRecord } from './validation.js';

const record = (overrides: Partial<DroneRecord> = {}): DroneRecord => ({
  ts: Date.now(),
  droneId: 'DRONE-1',
  manufacturer: 'DJI',
  model: 'Mavic',
  droneLat: 37.5,
  droneLon: -122.4,
  droneAltitude: 100,
  operatorLat: 37.5,
  operatorLon: -122.4,
  speed: 10,
  heading: 45,
  ...overrides,
});

describe('DroneDatabase', () => {
  let raw: BetterSqlite3.Database;
  let db: DroneDatabase;

  beforeEach(() => {
    raw = new BetterSqlite3(':memory:');
    db = new DroneDatabase(raw);
  });

  afterEach(() => {
    raw.close();
  });

  it('starts empty', () => {
    expect(db.getCount()).toBe(0);
  });

  it('inserts a batch of unique drones', () => {
    db.insertBatch([record({ droneId: 'A' }), record({ droneId: 'B' })]);
    expect(db.getCount()).toBe(2);
  });

  it('upserts on conflicting drone id', () => {
    db.insertBatch([record({ droneId: 'A', model: 'Old' })]);
    db.insertBatch([record({ droneId: 'A', model: 'New' })]);
    expect(db.getCount()).toBe(1);
  });

  it('ignores empty batches', () => {
    db.insertBatch([]);
    expect(db.getCount()).toBe(0);
  });
});
