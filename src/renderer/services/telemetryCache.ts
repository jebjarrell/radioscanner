/**
 * IndexedDB cache for telemetry data
 * Allows offline viewing of last received telemetry
 */

import type { TelemetryAircraft, TelemetryFrame } from '../types';

const DB_NAME = 'OnTheGoScanner';
const DB_VERSION = 1;
const TELEMETRY_STORE = 'telemetry';
const AIRCRAFT_STORE = 'aircraft';
const MAX_TELEMETRY_FRAMES = 10; // Keep last 10 frames
const MAX_AIRCRAFT_RECORDS = 500; // Keep last 500 aircraft records

interface CachedFrame {
  id: number;
  timestamp: number;
  data: TelemetryFrame;
}

interface CachedAircraft {
  icao: string;
  timestamp: number;
  data: TelemetryAircraft;
}

export class TelemetryCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  /**
   * Set to false once IndexedDB is known to be unavailable (missing API,
   * blocked, or open failure). When disabled the cache becomes a no-op so the
   * app keeps working fully without it, and we never retry-loop on a broken DB.
   */
  private available = true;

  /**
   * Whether the cache is currently usable. When false, all operations degrade
   * to no-ops rather than throwing.
   */
  isAvailable(): boolean {
    return this.available;
  }

  private disable(reason: string, error?: unknown): void {
    if (this.available) {
      console.warn(`[TelemetryCache] Disabling cache (degrading gracefully): ${reason}`, error);
    }
    this.available = false;
    this.db = null;
  }

  /**
   * Initialize the IndexedDB database.
   *
   * Never rejects: on any failure the cache is permanently disabled and the
   * promise resolves so callers can proceed without the cache.
   */
  async init(): Promise<void> {
    if (this.db || !this.available) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve) => {
      // indexedDB may be undefined (e.g. unavailable) and open() can throw.
      if (typeof indexedDB === 'undefined' || indexedDB === null) {
        this.disable('IndexedDB API unavailable');
        resolve();
        return;
      }

      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        this.disable('indexedDB.open threw', error);
        resolve();
        return;
      }

      request.onerror = () => {
        this.disable('failed to open database', request.error);
        resolve();
      };

      // Fires when the open is blocked by another connection; degrade rather
      // than hang forever waiting for success.
      request.onblocked = () => {
        this.disable('database open blocked');
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        // If the connection is force-closed later (e.g. version change), disable
        // so subsequent operations no-op instead of throwing.
        this.db.onclose = () => this.disable('database connection closed unexpectedly');
        console.log('[TelemetryCache] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create telemetry frames store
        if (!db.objectStoreNames.contains(TELEMETRY_STORE)) {
          const telemetryStore = db.createObjectStore(TELEMETRY_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          telemetryStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[TelemetryCache] Created telemetry store');
        }

        // Create aircraft records store
        if (!db.objectStoreNames.contains(AIRCRAFT_STORE)) {
          const aircraftStore = db.createObjectStore(AIRCRAFT_STORE, { keyPath: 'icao' });
          aircraftStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[TelemetryCache] Created aircraft store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save a telemetry frame to the cache
   */
  async saveFrame(frame: TelemetryFrame): Promise<void> {
    await this.init();

    if (!this.db) {
      // Cache unavailable; degrade silently so the app keeps working.
      return;
    }

    return new Promise((resolve) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([TELEMETRY_STORE, AIRCRAFT_STORE], 'readwrite');
      } catch (error) {
        this.disable('failed to open write transaction', error);
        resolve();
        return;
      }

      const telemetryStore = transaction.objectStore(TELEMETRY_STORE);
      const aircraftStore = transaction.objectStore(AIRCRAFT_STORE);

      // Save telemetry frame
      const cachedFrame: CachedFrame = {
        id: 0, // Will be auto-incremented
        timestamp: Date.now(),
        data: frame,
      };

      const frameRequest = telemetryStore.add(cachedFrame);

      frameRequest.onsuccess = () => {
        // Cleanup old frames (keep only last MAX_TELEMETRY_FRAMES)
        this.cleanupOldFrames(telemetryStore);
      };

      // Save aircraft data
      if (frame.aircraft && frame.aircraft.length > 0) {
        frame.aircraft.forEach((aircraft) => {
          const cachedAircraft: CachedAircraft = {
            icao: aircraft.hex,
            timestamp: Date.now(),
            data: aircraft,
          };

          aircraftStore.put(cachedAircraft);
        });

        // Cleanup old aircraft records
        this.cleanupOldAircraft(aircraftStore);
      }

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        console.error('[TelemetryCache] Transaction error:', transaction.error);
        // A write failure shouldn't reject into callers; just skip this frame.
        resolve();
      };
    });
  }

  /**
   * Get the last cached telemetry frame
   */
  async getLastFrame(): Promise<TelemetryFrame | null> {
    await this.init();

    if (!this.db) {
      return null;
    }

    return new Promise((resolve) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction(TELEMETRY_STORE, 'readonly');
      } catch (error) {
        this.disable('failed to open read transaction', error);
        resolve(null);
        return;
      }

      const store = transaction.objectStore(TELEMETRY_STORE);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Get most recent

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const cachedFrame = cursor.value as CachedFrame;
          resolve(cachedFrame.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[TelemetryCache] Failed to get last frame:', request.error);
        resolve(null);
      };
    });
  }

  /**
   * Get cached aircraft data
   */
  async getCachedAircraft(limit: number = 200): Promise<TelemetryAircraft[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction(AIRCRAFT_STORE, 'readonly');
      } catch (error) {
        this.disable('failed to open read transaction', error);
        resolve([]);
        return;
      }

      const store = transaction.objectStore(AIRCRAFT_STORE);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Most recent first

      const results: TelemetryAircraft[] = [];
      let count = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && count < limit) {
          const cachedAircraft = cursor.value as CachedAircraft;
          results.push(cachedAircraft.data);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        console.error('[TelemetryCache] Failed to get cached aircraft:', request.error);
        resolve(results);
      };
    });
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    await this.init();

    if (!this.db) {
      return;
    }

    return new Promise((resolve) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([TELEMETRY_STORE, AIRCRAFT_STORE], 'readwrite');
      } catch (error) {
        this.disable('failed to open clear transaction', error);
        resolve();
        return;
      }

      transaction.objectStore(TELEMETRY_STORE).clear();
      transaction.objectStore(AIRCRAFT_STORE).clear();

      transaction.oncomplete = () => {
        console.log('[TelemetryCache] Cache cleared');
        resolve();
      };

      transaction.onerror = () => {
        console.error('[TelemetryCache] Failed to clear cache:', transaction.error);
        resolve();
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ frameCount: number; aircraftCount: number }> {
    await this.init();

    if (!this.db) {
      return { frameCount: 0, aircraftCount: 0 };
    }

    return new Promise((resolve) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([TELEMETRY_STORE, AIRCRAFT_STORE], 'readonly');
      } catch (error) {
        this.disable('failed to open stats transaction', error);
        resolve({ frameCount: 0, aircraftCount: 0 });
        return;
      }

      const telemetryCountRequest = transaction.objectStore(TELEMETRY_STORE).count();
      const aircraftCountRequest = transaction.objectStore(AIRCRAFT_STORE).count();

      let frameCount = 0;
      let aircraftCount = 0;

      telemetryCountRequest.onsuccess = () => {
        frameCount = telemetryCountRequest.result;
      };

      aircraftCountRequest.onsuccess = () => {
        aircraftCount = aircraftCountRequest.result;
      };

      transaction.oncomplete = () => {
        resolve({ frameCount, aircraftCount });
      };

      transaction.onerror = () => {
        console.error('[TelemetryCache] Failed to get stats:', transaction.error);
        resolve({ frameCount, aircraftCount });
      };
    });
  }

  /**
   * Cleanup old telemetry frames
   */
  private cleanupOldFrames(store: IDBObjectStore): void {
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;
      if (count > MAX_TELEMETRY_FRAMES) {
        const deleteCount = count - MAX_TELEMETRY_FRAMES;
        const cursorRequest = store.openCursor();
        let deleted = 0;

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
    };
  }

  /**
   * Cleanup old aircraft records
   */
  private cleanupOldAircraft(store: IDBObjectStore): void {
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;
      if (count > MAX_AIRCRAFT_RECORDS) {
        const index = store.index('timestamp');
        const cursorRequest = index.openCursor(); // Oldest first
        const deleteCount = count - MAX_AIRCRAFT_RECORDS;
        let deleted = 0;

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log('[TelemetryCache] Database closed');
    }
  }
}

// Singleton instance
export const telemetryCache = new TelemetryCache();
