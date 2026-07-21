// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdType, MessageType, UaType } from './astmParser';
import { BluetoothRidClient } from './bluetoothRidClient';

const MESSAGE_LENGTH = 25;

function makeMessage(type: number, fill?: (buf: Buffer) => void): Buffer {
  const buf = Buffer.alloc(MESSAGE_LENGTH);
  buf.writeUInt8(((type & 0x0f) << 4) | 0x02, 0); // proto version 2
  fill?.(buf);
  return buf;
}

/** Wrap a message payload in the BLE 0xFFFA service data prefix. */
function wrap(payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x0d, 0x00]), payload]);
}

function basicIdMessage(uasId: string, uaType = UaType.HELICOPTER_OR_MULTIROTOR): Buffer {
  return makeMessage(MessageType.BASIC_ID, (buf) => {
    buf.writeUInt8((IdType.SERIAL_NUMBER << 4) | uaType, 1);
    buf.write(uasId, 2, 'ascii');
  });
}

function locationMessage(lat: number, lon: number): Buffer {
  return makeMessage(MessageType.LOCATION_VECTOR, (buf) => {
    buf.writeUInt8(0x20, 1); // status: airborne
    buf.writeUInt8(45, 2); // direction 45 deg
    buf.writeUInt8(40, 3); // 10 m/s
    buf.writeInt32LE(Math.round(lat * 1e7), 5);
    buf.writeInt32LE(Math.round(lon * 1e7), 9);
    buf.writeUInt16LE(2200, 15); // WGS84 altitude 100 m
  });
}

function systemMessage(lat: number, lon: number): Buffer {
  return makeMessage(MessageType.SYSTEM, (buf) => {
    buf.writeUInt8(0x01, 1);
    buf.writeInt32LE(Math.round(lat * 1e7), 2);
    buf.writeInt32LE(Math.round(lon * 1e7), 6);
    buf.writeUInt16LE(2100, 18); // operator altitude 50 m
  });
}

describe('BluetoothRidClient', () => {
  let client: BluetoothRidClient;

  beforeEach(() => {
    client = new BluetoothRidClient();
  });

  afterEach(() => {
    client.stop();
    vi.useRealTimers();
  });

  it('reports no detections before any advertisement arrives', () => {
    expect(client.getDetections()).toEqual([]);
  });

  it('aggregates Basic ID, Location, and System messages from one drone', () => {
    const address = 'aa:bb:cc:dd:ee:ff';
    client.ingestServiceData(address, wrap(basicIdMessage('DJI-SERIAL-1')));
    client.ingestServiceData(address, wrap(locationMessage(40.7128, -74.006)));
    client.ingestServiceData(address, wrap(systemMessage(40.7, -74.0)));

    const detections = client.getDetections();
    expect(detections).toHaveLength(1);
    const drone = detections[0];
    expect(drone).toMatchObject({
      droneId: 'DJI-SERIAL-1',
      manufacturer: 'DJI',
      uaType: 'Helicopter/Multirotor',
      speed: 10,
      heading: 45,
    });
    expect(drone?.droneLat).toBeCloseTo(40.7128, 4);
    expect(drone?.droneLon).toBeCloseTo(-74.006, 4);
    expect(drone?.droneAltitude).toBe(100);
    expect(drone?.operatorLat).toBeCloseTo(40.7, 4);
    expect(drone?.operatorLon).toBeCloseTo(-74.0, 4);
  });

  it('decodes a message pack advertisement in a single ingest', () => {
    const pack = Buffer.concat([
      Buffer.from([(0xf << 4) | 0x2, MESSAGE_LENGTH, 2]),
      basicIdMessage('PACKED-DRONE'),
      locationMessage(34.05, -118.24),
    ]);

    client.ingestServiceData('11:22:33:44:55:66', wrap(pack));

    const detections = client.getDetections();
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({ droneId: 'PACKED-DRONE' });
    expect(detections[0]?.droneLat).toBeCloseTo(34.05, 4);
  });

  it('does not report a drone until a Basic ID message provides its identity', () => {
    client.ingestServiceData('aa:aa:aa:aa:aa:aa', wrap(locationMessage(40.0, -75.0)));
    expect(client.getDetections()).toEqual([]);
  });

  it('tracks multiple drones by BLE address', () => {
    client.ingestServiceData('11:11:11:11:11:11', wrap(basicIdMessage('DRONE-A')));
    client.ingestServiceData(
      '22:22:22:22:22:22',
      wrap(basicIdMessage('DRONE-B', UaType.AEROPLANE)),
    );

    const ids = client
      .getDetections()
      .map((d) => d.droneId)
      .sort();
    expect(ids).toEqual(['DRONE-A', 'DRONE-B']);
  });

  it('ignores malformed service data without throwing', () => {
    client.ingestServiceData('aa:bb:cc:dd:ee:ff', Buffer.alloc(0));
    client.ingestServiceData('aa:bb:cc:dd:ee:ff', Buffer.from([0x0d]));
    client.ingestServiceData('aa:bb:cc:dd:ee:ff', Buffer.alloc(40, 0xff));
    expect(client.getDetections()).toEqual([]);
  });

  it('expires drones not seen within the stale timeout', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T12:00:00Z'));

    client.ingestServiceData('aa:bb:cc:dd:ee:ff', wrap(basicIdMessage('STALE-DRONE')));
    expect(client.getDetections()).toHaveLength(1);

    vi.setSystemTime(new Date('2026-07-21T12:00:31Z')); // past the 30s stale timeout
    client.cleanupStale();
    expect(client.getDetections()).toEqual([]);
  });
});
