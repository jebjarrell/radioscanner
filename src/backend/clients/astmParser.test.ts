import { describe, expect, it } from 'vitest';

import {
  AstmF3411Parser,
  IdType,
  MessageType,
  type AstmBasicId,
  type AstmLocation,
  type AstmOperatorId,
  type AstmSelfId,
  type AstmSystem,
} from './astmParser.js';

const MSG_LEN = 25;

/** Build a 25-byte buffer with the given message type in byte 0. */
const newMessage = (type: number): Buffer => {
  const buf = Buffer.alloc(MSG_LEN);
  buf.writeUInt8(type, 0);
  return buf;
};

describe('AstmF3411Parser.parse', () => {
  it('returns null for buffers shorter than 25 bytes', () => {
    expect(AstmF3411Parser.parse(Buffer.alloc(10))).toBeNull();
  });

  it('returns null for an unknown message type', () => {
    expect(AstmF3411Parser.parse(newMessage(0x9))).toBeNull();
  });

  it('parses a Basic ID message', () => {
    const buf = newMessage(MessageType.BASIC_ID);
    buf.writeUInt8(IdType.SERIAL_NUMBER, 1);
    buf.write('SERIAL123', 2, 'ascii');
    const result = AstmF3411Parser.parse(buf) as AstmBasicId;

    expect(result).not.toBeNull();
    expect(result.messageType).toBe(MessageType.BASIC_ID);
    expect(result.idType).toBe(IdType.SERIAL_NUMBER);
    expect(result.uasId).toBe('SERIAL123');
  });

  it('returns null for a Basic ID with an empty UAS id', () => {
    const buf = newMessage(MessageType.BASIC_ID);
    buf.writeUInt8(IdType.SERIAL_NUMBER, 1);
    expect(AstmF3411Parser.parse(buf)).toBeNull();
  });

  it('parses a Location/Vector message', () => {
    const buf = newMessage(MessageType.LOCATION_VECTOR);
    buf.writeUInt8(0x12, 1); // status
    buf.writeUInt8(90, 2); // direction: 90 * 2 = 180 deg
    buf.writeUInt8(40, 3); // speedHorizontal: 40 * 0.25 = 10 m/s
    buf.writeInt8(-4, 4); // speedVertical: -4 * 0.5 = -2 m/s
    buf.writeInt32LE(Math.round(37.5 * 1e7), 5); // latitude
    buf.writeInt32LE(Math.round(-122.4 * 1e7), 9); // longitude
    buf.writeUInt16LE(3000, 13); // altitude: 3000 * 0.5 - 1000 = 500 m
    buf.writeUInt16LE(2200, 15); // height: 2200 * 0.5 - 1000 = 100 m
    buf.writeUInt8(2, 17); // horizontal accuracy
    buf.writeUInt8(3, 18); // vertical accuracy
    buf.writeUInt8(1, 20); // speed accuracy
    buf.writeUInt16LE(600, 21); // timestamp: 600 * 0.1 = 60s

    const result = AstmF3411Parser.parse(buf) as AstmLocation;

    expect(result.messageType).toBe(MessageType.LOCATION_VECTOR);
    expect(result.direction).toBe(180);
    expect(result.speedHorizontal).toBeCloseTo(10);
    expect(result.speedVertical).toBeCloseTo(-2);
    expect(result.latitude).toBeCloseTo(37.5, 4);
    expect(result.longitude).toBeCloseTo(-122.4, 4);
    expect(result.altitudeWgs84).toBeCloseTo(500);
    expect(result.heightAboveTakeoff).toBeCloseTo(100);
    expect(result.horizontalAccuracy).toBe(10);
    expect(result.timestamp).toBeCloseTo(60);
  });

  it('returns null for a Location message with the invalid lat sentinel', () => {
    const buf = newMessage(MessageType.LOCATION_VECTOR);
    buf.writeInt32LE(0x7fffffff, 5);
    buf.writeInt32LE(Math.round(-122.4 * 1e7), 9);
    expect(AstmF3411Parser.parse(buf)).toBeNull();
  });

  it('returns null for a Location message with out-of-range coordinates', () => {
    const buf = newMessage(MessageType.LOCATION_VECTOR);
    buf.writeInt32LE(Math.round(95 * 1e7), 5); // 95 deg latitude (invalid)
    buf.writeInt32LE(Math.round(10 * 1e7), 9);
    expect(AstmF3411Parser.parse(buf)).toBeNull();
  });

  it('parses a System message with operator location', () => {
    const buf = newMessage(MessageType.SYSTEM);
    buf.writeUInt8(1, 1); // operatorLocationType
    buf.writeInt32LE(Math.round(37.6 * 1e7), 4); // operator latitude
    buf.writeInt32LE(Math.round(-122.3 * 1e7), 8); // operator longitude
    buf.writeInt32LE(120, 16); // operator altitude
    buf.writeUInt16LE(1234, 20); // timestamp

    const result = AstmF3411Parser.parse(buf) as AstmSystem;

    expect(result.messageType).toBe(MessageType.SYSTEM);
    expect(result.operatorLocationType).toBe(1);
    expect(result.operatorLatitude).toBeCloseTo(37.6, 4);
    expect(result.operatorLongitude).toBeCloseTo(-122.3, 4);
    expect(result.operatorAltitude).toBe(120);
    expect(result.timestamp).toBe(1234);
  });

  it('returns null for a System message with invalid operator coordinates', () => {
    const buf = newMessage(MessageType.SYSTEM);
    buf.writeInt32LE(Math.round(200 * 1e7), 4);
    buf.writeInt32LE(Math.round(10 * 1e7), 8);
    expect(AstmF3411Parser.parse(buf)).toBeNull();
  });

  it('parses a Self-ID message', () => {
    const buf = newMessage(MessageType.SELF_ID);
    buf.writeUInt8(0, 1);
    buf.write('Recreational flight', 2, 'ascii');
    const result = AstmF3411Parser.parse(buf) as AstmSelfId;

    expect(result.messageType).toBe(MessageType.SELF_ID);
    expect(result.description).toBe('Recreational flight');
  });

  it('parses an Operator ID message', () => {
    const buf = newMessage(MessageType.OPERATOR_ID);
    buf.writeUInt8(0, 1);
    buf.write('OP-OPERATOR-99', 2, 'ascii');
    const result = AstmF3411Parser.parse(buf) as AstmOperatorId;

    expect(result.messageType).toBe(MessageType.OPERATOR_ID);
    expect(result.operatorId).toBe('OP-OPERATOR-99');
  });

  it('parses an Authentication message and copies the auth data', () => {
    const buf = newMessage(MessageType.AUTHENTICATION);
    buf.writeUInt8(5, 1); // authType
    buf.writeUInt8(2, 2); // pageNumber
    buf.fill(0xab, 3, 25);
    const result = AstmF3411Parser.parse(buf);

    expect(result).not.toBeNull();
    if (result && result.messageType === MessageType.AUTHENTICATION) {
      expect(result.authType).toBe(5);
      expect(result.pageNumber).toBe(2);
      expect(result.authData).toHaveLength(22);
      expect(result.authData[0]).toBe(0xab);
    }
  });
});
