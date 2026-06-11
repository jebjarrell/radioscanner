import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SettingsDatabase } from './settingsDb.js';

describe('SettingsDatabase', () => {
  let raw: BetterSqlite3.Database;
  let db: SettingsDatabase;

  beforeEach(() => {
    raw = new BetterSqlite3(':memory:');
    db = new SettingsDatabase(raw);
  });

  afterEach(() => {
    if (raw.open) {
      raw.close();
    }
  });

  it('seeds default settings on construction', () => {
    const all = db.getAll();
    expect(all['session.storageMode']).toBe('memory');
    expect(all['services.backendPort']).toBe('3000');
    expect(all['preferences.distanceUnit']).toBe('miles');
    expect(all['performance.peakDetectionSensitivity']).toBe('medium');
  });

  it('does not overwrite existing values when re-seeding', () => {
    db.set('services.backendPort', '9999');
    const reopened = new SettingsDatabase(raw);
    expect(reopened.getAll()['services.backendPort']).toBe('9999');
  });

  it('supports get/set round-trips', () => {
    db.set('preferences.mapStyle', 'satellite');
    expect(db.getAll()['preferences.mapStyle']).toBe('satellite');
  });

  it('upserts an existing key with set', () => {
    db.set('preferences.mapStyle', 'one');
    db.set('preferences.mapStyle', 'two');
    expect(db.getAll()['preferences.mapStyle']).toBe('two');
  });

  it('applies multiple updates atomically with setMany', () => {
    db.setMany([
      { key: 'services.kismetPort', value: '2502' },
      { key: 'services.gpsdPort', value: '2948' },
    ]);
    const all = db.getAll();
    expect(all['services.kismetPort']).toBe('2502');
    expect(all['services.gpsdPort']).toBe('2948');
  });

  it('resets all settings back to defaults', () => {
    db.set('services.backendPort', '9999');
    db.reset();
    expect(db.getAll()['services.backendPort']).toBe('3000');
  });

  it('resets only a single section when provided', () => {
    db.set('services.backendPort', '9999');
    db.set('notifications.duration', '1');
    db.reset('services');
    const all = db.getAll();
    expect(all['services.backendPort']).toBe('3000');
    // notifications was not in the reset section, so it keeps the custom value
    expect(all['notifications.duration']).toBe('1');
  });

  it('closes the underlying database', () => {
    db.close();
    expect(raw.open).toBe(false);
  });
});
