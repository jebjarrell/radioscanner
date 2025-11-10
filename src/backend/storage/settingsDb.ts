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
      // Session
      ['session.storageMode', 'memory'],

      // Service URLs
      ['services.backendHost', '127.0.0.1'],
      ['services.backendPort', '3000'],
      ['services.dump1090Host', '127.0.0.1'],
      ['services.dump1090Port', '8080'],
      ['services.kismetHost', '127.0.0.1'],
      ['services.kismetPort', '2501'],
      ['services.rtlTcpHost', '127.0.0.1'],
      ['services.rtlTcpPort', '1234'],
      ['services.gpsdHost', '127.0.0.1'],
      ['services.gpsdPort', '2947'],

      // User Preferences
      ['preferences.distanceUnit', 'miles'],
      ['preferences.mapStyle', 'demotiles'],
      ['preferences.mapDefaultCenterLat', '40.7306'],
      ['preferences.mapDefaultCenterLon', '-73.9352'],
      ['preferences.mapDefaultZoom', '9.5'],

      // Notifications
      ['notifications.enabled', 'true'],
      ['notifications.droneDetected', 'true'],
      ['notifications.aircraftProximity', 'false'],
      ['notifications.aircraftProximityThresholdMiles', '5'],
      ['notifications.newSignal', 'true'],
      ['notifications.duration', '4000'],
      ['notifications.position', 'top-right'],

      // Performance
      ['performance.waterfallMaxRows', '100'],
      ['performance.maxAircraftDisplayed', '200'],
      ['performance.peakDetectionSensitivity', 'medium'],
      ['performance.telemetryUpdateInterval', '1000'],

      // Legacy (for backward compatibility)
      ['distance_unit', 'miles'],
      ['default_band', 'airband'],
      ['map_zoom', '10'],
      ['map_center_lat', '40.7306'],
      ['map_center_lon', '-73.9352'],
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

  setMany(updates: Array<{ key: string; value: string }>): void {
    const tx = this.db.transaction(() => {
      for (const { key, value } of updates) {
        this.upsertStmt.run(key, value, Date.now());
      }
    });
    tx();
  }

  reset(section?: string): void {
    const defaults: Array<[string, string]> = [
      // Session
      ['session.storageMode', 'memory'],

      // Service URLs
      ['services.backendHost', '127.0.0.1'],
      ['services.backendPort', '3000'],
      ['services.dump1090Host', '127.0.0.1'],
      ['services.dump1090Port', '8080'],
      ['services.kismetHost', '127.0.0.1'],
      ['services.kismetPort', '2501'],
      ['services.rtlTcpHost', '127.0.0.1'],
      ['services.rtlTcpPort', '1234'],
      ['services.gpsdHost', '127.0.0.1'],
      ['services.gpsdPort', '2947'],

      // User Preferences
      ['preferences.distanceUnit', 'miles'],
      ['preferences.mapStyle', 'demotiles'],
      ['preferences.mapDefaultCenterLat', '40.7306'],
      ['preferences.mapDefaultCenterLon', '-73.9352'],
      ['preferences.mapDefaultZoom', '9.5'],

      // Notifications
      ['notifications.enabled', 'true'],
      ['notifications.droneDetected', 'true'],
      ['notifications.aircraftProximity', 'false'],
      ['notifications.aircraftProximityThresholdMiles', '5'],
      ['notifications.newSignal', 'true'],
      ['notifications.duration', '4000'],
      ['notifications.position', 'top-right'],

      // Performance
      ['performance.waterfallMaxRows', '100'],
      ['performance.maxAircraftDisplayed', '200'],
      ['performance.peakDetectionSensitivity', 'medium'],
      ['performance.telemetryUpdateInterval', '1000'],

      // Legacy
      ['distance_unit', 'miles'],
      ['default_band', 'airband'],
      ['map_zoom', '10'],
      ['map_center_lat', '40.7306'],
      ['map_center_lon', '-73.9352'],
    ];

    let filtered = defaults;
    if (section) {
      filtered = defaults.filter(([key]) => key.startsWith(`${section}.`));
    }

    const tx = this.db.transaction(() => {
      for (const [key, value] of filtered) {
        this.upsertStmt.run(key, value, Date.now());
      }
    });
    tx();
  }

  close(): void {
    this.db.close();
  }
}
