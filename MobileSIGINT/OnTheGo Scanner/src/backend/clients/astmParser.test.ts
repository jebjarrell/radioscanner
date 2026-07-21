// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { AstmF3411Parser, IdType, MessageType, UaType } from './astmParser';

const MESSAGE_LENGTH = 25;

/**
 * Allocate a zeroed 25-byte ASTM message with the given type nibble and
 * protocol version nibble packed into byte 0, then fill it.
 * Per ASTM F3411-22a, byte 0 = (MessageType << 4) | ProtoVersion.
 */
function makeMessage(type: number, protoVersion = 2, fill?: (buf: Buffer) => void): Buffer {
  const buf = Buffer.alloc(MESSAGE_LENGTH);
  buf.writeUInt8(((type & 0x0f) << 4) | (protoVersion & 0x0f), 0);
  fill?.(buf);
  return buf;
}

describe('AstmF3411Parser.parse', () => {
  it('returns null for a buffer shorter than 25 bytes', () => {
    expect(AstmF3411Parser.parse(Buffer.alloc(10))).toBeNull();
  });

  it('returns null for an unknown message type', () => {
    expect(AstmF3411Parser.parse(makeMessage(0x9))).toBeNull();
  });

  it('reads the message type from the upper nibble regardless of protocol version', () => {
    // Basic ID with proto version 2 => byte 0 is 0x02. A whole-byte reader
    // would misparse this as an Authentication message.
    for (const protoVersion of [0, 1, 2]) {
      const msg = makeMessage(MessageType.BASIC_ID, protoVersion, (buf) => {
        buf.writeUInt8((IdType.SERIAL_NUMBER << 4) | UaType.HELICOPTER_OR_MULTIROTOR, 1);
        buf.write('DRONE-123', 2, 'ascii');
      });

      const result = AstmF3411Parser.parse(msg);
      expect(result?.messageType).toBe(MessageType.BASIC_ID);
    }
  });

  it('parses a Basic ID message with ID type and UA type nibbles', () => {
    const msg = makeMessage(MessageType.BASIC_ID, 2, (buf) => {
      buf.writeUInt8((IdType.SERIAL_NUMBER << 4) | UaType.HELICOPTER_OR_MULTIROTOR, 1);
      buf.write('DRONE-123', 2, 'ascii');
    });

    expect(AstmF3411Parser.parse(msg)).toEqual({
      messageType: MessageType.BASIC_ID,
      protoVersion: 2,
      idType: IdType.SERIAL_NUMBER,
      uaType: UaType.HELICOPTER_OR_MULTIROTOR,
      uasId: 'DRONE-123',
    });
  });

  it('returns null for a Basic ID message with an empty UAS id', () => {
    const msg = makeMessage(MessageType.BASIC_ID, 2, (buf) => {
      buf.writeUInt8((IdType.NONE << 4) | UaType.NONE, 1);
    });

    expect(AstmF3411Parser.parse(msg)).toBeNull();
  });

  it('decodes a Location/Vector message with spec field offsets and scaling', () => {
    const msg = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      // Byte 1: Status=2 (airborne) in upper nibble; HeightType=0, EW=0, SpeedMult=0
      buf.writeUInt8(0x20, 1);
      buf.writeUInt8(90, 2); // direction: 90 deg (EW bit clear)
      buf.writeUInt8(40, 3); // horizontal speed: 40 * 0.25 => 10 m/s
      buf.writeInt8(-4, 4); // vertical speed: -4 * 0.5 => -2 m/s
      buf.writeInt32LE(407128000, 5); // latitude: 40.7128 deg
      buf.writeInt32LE(-740060000, 9); // longitude: -74.006 deg
      buf.writeUInt16LE(2300, 13); // pressure altitude: 2300 * 0.5 - 1000 => 150 m
      buf.writeUInt16LE(2200, 15); // geodetic (WGS84) altitude: 2200 * 0.5 - 1000 => 100 m
      buf.writeUInt16LE(2100, 17); // height above takeoff: 2100 * 0.5 - 1000 => 50 m
      buf.writeUInt8((0x3 << 4) | 0xb, 19); // vert accuracy 3 (<25m), horiz accuracy 11 (<3m)
      buf.writeUInt8((0x0 << 4) | 0x3, 20); // baro accuracy unknown, speed accuracy 3 (<1m/s)
      buf.writeUInt16LE(6000, 21); // timestamp: 6000 * 0.1 => 600 s
    });

    const result = AstmF3411Parser.parse(msg);
    expect(result?.messageType).toBe(MessageType.LOCATION_VECTOR);
    if (result?.messageType !== MessageType.LOCATION_VECTOR) {
      throw new Error('expected a Location/Vector message');
    }

    expect(result.status).toBe(2);
    expect(result.direction).toBe(90);
    expect(result.speedHorizontal).toBe(10);
    expect(result.speedVertical).toBe(-2);
    expect(result.latitude).toBeCloseTo(40.7128, 6);
    expect(result.longitude).toBeCloseTo(-74.006, 6);
    expect(result.altitudeBaro).toBe(150);
    expect(result.altitudeWgs84).toBe(100);
    expect(result.heightAboveTakeoff).toBe(50);
    expect(result.horizontalAccuracy).toBe(3);
    expect(result.verticalAccuracy).toBe(25);
    expect(result.speedAccuracy).toBe(1);
    expect(result.timestamp).toBeCloseTo(600, 6);
  });

  it('adds 180 degrees to direction when the E/W segment bit is set', () => {
    const msg = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      buf.writeUInt8(0x22, 1); // status 2, EW bit (0x02) set
      buf.writeUInt8(90, 2); // 90 + 180 => 270 deg
      buf.writeInt32LE(407128000, 5);
      buf.writeInt32LE(-740060000, 9);
    });

    const result = AstmF3411Parser.parse(msg);
    if (result?.messageType !== MessageType.LOCATION_VECTOR) {
      throw new Error('expected a Location/Vector message');
    }
    expect(result.direction).toBe(270);
  });

  it('reports an unknown direction as null', () => {
    const msg = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      buf.writeUInt8(0x20, 1);
      buf.writeUInt8(181, 2); // encoded > 180 with EW clear => unknown per spec
      buf.writeInt32LE(407128000, 5);
      buf.writeInt32LE(-740060000, 9);
    });

    const result = AstmF3411Parser.parse(msg);
    if (result?.messageType !== MessageType.LOCATION_VECTOR) {
      throw new Error('expected a Location/Vector message');
    }
    expect(result.direction).toBeNull();
  });

  it('applies the speed multiplier bit for high horizontal speeds', () => {
    const msg = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      buf.writeUInt8(0x21, 1); // status 2, SpeedMult bit (0x01) set
      buf.writeUInt8(20, 3); // 20 * 0.75 + 255 * 0.25 => 78.75 m/s
      buf.writeInt32LE(407128000, 5);
      buf.writeInt32LE(-740060000, 9);
    });

    const result = AstmF3411Parser.parse(msg);
    if (result?.messageType !== MessageType.LOCATION_VECTOR) {
      throw new Error('expected a Location/Vector message');
    }
    expect(result.speedHorizontal).toBeCloseTo(78.75, 6);
  });

  it('reports unknown altitudes (encoded 0 => -1000m sentinel) as null', () => {
    const msg = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      buf.writeInt32LE(407128000, 5);
      buf.writeInt32LE(-740060000, 9);
      // altitude/height fields left zeroed => -1000 sentinel
    });

    const result = AstmF3411Parser.parse(msg);
    if (result?.messageType !== MessageType.LOCATION_VECTOR) {
      throw new Error('expected a Location/Vector message');
    }
    expect(result.altitudeBaro).toBeNull();
    expect(result.altitudeWgs84).toBeNull();
    expect(result.heightAboveTakeoff).toBeNull();
  });

  it('returns null for a Location message with out-of-range coordinates', () => {
    const msg = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      buf.writeInt32LE(1_000_000_000, 5); // latitude 100 deg => invalid
      buf.writeInt32LE(0, 9);
    });

    expect(AstmF3411Parser.parse(msg)).toBeNull();
  });

  it('returns null for a Location message with the 0,0 unknown-position sentinel', () => {
    const msg = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      buf.writeInt32LE(0, 5);
      buf.writeInt32LE(0, 9);
    });

    expect(AstmF3411Parser.parse(msg)).toBeNull();
  });

  it('decodes a System message with spec field offsets', () => {
    const msg = makeMessage(MessageType.SYSTEM, 2, (buf) => {
      buf.writeUInt8(0x01, 1); // operator location type 1 (takeoff), classification 0
      buf.writeInt32LE(407000000, 2); // operator latitude: 40.7 deg
      buf.writeInt32LE(-740000000, 6); // operator longitude: -74.0 deg
      buf.writeUInt16LE(1, 10); // area count
      buf.writeUInt16LE(2250, 18); // operator altitude: 2250 * 0.5 - 1000 => 125 m
      buf.writeUInt32LE(220838400, 20); // timestamp: seconds since 2019-01-01T00:00Z
    });

    const result = AstmF3411Parser.parse(msg);
    expect(result?.messageType).toBe(MessageType.SYSTEM);
    if (result?.messageType !== MessageType.SYSTEM) {
      throw new Error('expected a System message');
    }

    expect(result.operatorLocationType).toBe(1);
    expect(result.operatorLatitude).toBeCloseTo(40.7, 6);
    expect(result.operatorLongitude).toBeCloseTo(-74.0, 6);
    expect(result.operatorAltitude).toBe(125);
    expect(result.timestamp).toBe(220838400);
  });

  it('returns null for a System message with the 0,0 unknown-operator sentinel', () => {
    const msg = makeMessage(MessageType.SYSTEM, 2);
    expect(AstmF3411Parser.parse(msg)).toBeNull();
  });

  it('parses an Operator ID string', () => {
    const msg = makeMessage(MessageType.OPERATOR_ID, 2, (buf) => {
      buf.writeUInt8(0, 1);
      buf.write('FA12345', 2, 'ascii');
    });

    expect(AstmF3411Parser.parse(msg)).toEqual({
      messageType: MessageType.OPERATOR_ID,
      protoVersion: 2,
      operatorIdType: 0,
      operatorId: 'FA12345',
    });
  });

  it('parses a Self-ID description', () => {
    const msg = makeMessage(MessageType.SELF_ID, 2, (buf) => {
      buf.writeUInt8(1, 1);
      buf.write('Test Flight', 2, 'ascii');
    });

    expect(AstmF3411Parser.parse(msg)).toEqual({
      messageType: MessageType.SELF_ID,
      protoVersion: 2,
      descriptionType: 1,
      description: 'Test Flight',
    });
  });

  it('parses an Authentication message with type and page packed in byte 1', () => {
    const msg = makeMessage(MessageType.AUTHENTICATION, 2, (buf) => {
      buf.writeUInt8((0x2 << 4) | 0x1, 1); // auth type 2, page number 1
      buf.write('AUTH', 2, 'ascii');
    });

    const result = AstmF3411Parser.parse(msg);
    expect(result?.messageType).toBe(MessageType.AUTHENTICATION);
    if (result?.messageType !== MessageType.AUTHENTICATION) {
      throw new Error('expected an Authentication message');
    }

    expect(result.authType).toBe(2);
    expect(result.pageNumber).toBe(1);
    expect(result.authData).toHaveLength(23);
    expect(result.authData.subarray(0, 4).toString('ascii')).toBe('AUTH');
  });

  it('decodes horizontal accuracy codes per the spec table (larger code => tighter bound)', () => {
    const build = (accCode: number): Buffer =>
      makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
        buf.writeInt32LE(407128000, 5);
        buf.writeInt32LE(-740060000, 9);
        buf.writeUInt8(accCode & 0x0f, 19); // horizontal accuracy in lower nibble
      });

    const cases: Array<[number, number | null]> = [
      [0, null], // unknown
      [1, 18520], // < 10 NM
      [9, 30], // < 30 m
      [11, 3], // < 3 m
      [12, 1], // < 1 m
    ];

    for (const [code, expected] of cases) {
      const result = AstmF3411Parser.parse(build(code));
      if (result?.messageType !== MessageType.LOCATION_VECTOR) {
        throw new Error('expected Location/Vector messages');
      }
      expect(result.horizontalAccuracy).toBe(expected);
    }
  });
});

describe('AstmF3411Parser.parseAdvertisement', () => {
  const wrap = (payload: Buffer): Buffer =>
    // BLE service data for UUID 0xFFFA: [0x0D app code, message counter, payload]
    Buffer.concat([Buffer.from([0x0d, 0x42]), payload]);

  it('unwraps the BLE application code and counter prefix around a single message', () => {
    const basicId = makeMessage(MessageType.BASIC_ID, 2, (buf) => {
      buf.writeUInt8((IdType.SERIAL_NUMBER << 4) | UaType.AEROPLANE, 1);
      buf.write('WRAPPED-1', 2, 'ascii');
    });

    const messages = AstmF3411Parser.parseAdvertisement(wrap(basicId));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageType: MessageType.BASIC_ID,
      uasId: 'WRAPPED-1',
    });
  });

  it('decodes a Message Pack (type 0xF) into its constituent messages', () => {
    const basicId = makeMessage(MessageType.BASIC_ID, 2, (buf) => {
      buf.writeUInt8((IdType.SERIAL_NUMBER << 4) | UaType.HELICOPTER_OR_MULTIROTOR, 1);
      buf.write('PACKED-1', 2, 'ascii');
    });
    const location = makeMessage(MessageType.LOCATION_VECTOR, 2, (buf) => {
      buf.writeUInt8(0x20, 1);
      buf.writeInt32LE(407128000, 5);
      buf.writeInt32LE(-740060000, 9);
    });

    // Pack header: byte 0 = (0xF << 4) | version, byte 1 = message size, byte 2 = count
    const pack = Buffer.concat([
      Buffer.from([(0xf << 4) | 0x2, MESSAGE_LENGTH, 2]),
      basicId,
      location,
    ]);

    const messages = AstmF3411Parser.parseAdvertisement(wrap(pack));
    expect(messages).toHaveLength(2);
    expect(messages[0]?.messageType).toBe(MessageType.BASIC_ID);
    expect(messages[1]?.messageType).toBe(MessageType.LOCATION_VECTOR);
  });

  it('drops undecodable messages inside a pack but keeps the rest', () => {
    const bogus = Buffer.alloc(MESSAGE_LENGTH, 0xff);
    const basicId = makeMessage(MessageType.BASIC_ID, 2, (buf) => {
      buf.writeUInt8((IdType.SERIAL_NUMBER << 4) | UaType.NONE, 1);
      buf.write('KEEP-ME', 2, 'ascii');
    });
    const pack = Buffer.concat([
      Buffer.from([(0xf << 4) | 0x2, MESSAGE_LENGTH, 2]),
      bogus,
      basicId,
    ]);

    const messages = AstmF3411Parser.parseAdvertisement(wrap(pack));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ uasId: 'KEEP-ME' });
  });

  it('tolerates service data without the 0x0D application code prefix', () => {
    // Some receivers strip the prefix before handing data over; accept a bare message.
    const basicId = makeMessage(MessageType.BASIC_ID, 2, (buf) => {
      buf.writeUInt8((IdType.SERIAL_NUMBER << 4) | UaType.NONE, 1);
      buf.write('BARE-1', 2, 'ascii');
    });

    const messages = AstmF3411Parser.parseAdvertisement(basicId);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ uasId: 'BARE-1' });
  });

  it('returns an empty array for empty or truncated data', () => {
    expect(AstmF3411Parser.parseAdvertisement(Buffer.alloc(0))).toEqual([]);
    expect(AstmF3411Parser.parseAdvertisement(Buffer.from([0x0d, 0x01, 0x02]))).toEqual([]);
  });
});
