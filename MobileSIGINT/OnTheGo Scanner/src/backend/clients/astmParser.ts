/**
 * ASTM F3411 Remote ID Message Parser
 *
 * Parses ASTM F3411-22a compliant Remote ID messages from Bluetooth advertisements.
 * Field layouts follow the encoded message structs published in the OpenDroneID
 * reference implementation (opendroneid-core-c), which implements the ASTM spec.
 *
 * Wire format notes:
 * - Every message is 25 bytes; byte 0 packs (MessageType << 4) | ProtocolVersion.
 * - BLE service data for UUID 0xFFFA carries a 2-byte prefix (0x0D application
 *   code + message counter) before the message payload.
 * - BT5 extended advertising uses a Message Pack (type 0xF) bundling several
 *   25-byte messages behind a 3-byte pack header.
 *
 * @see https://www.astm.org/f3411-22a.html
 * @see https://github.com/opendroneid/opendroneid-core-c
 */

export enum MessageType {
  BASIC_ID = 0x0,
  LOCATION_VECTOR = 0x1,
  AUTHENTICATION = 0x2,
  SELF_ID = 0x3,
  SYSTEM = 0x4,
  OPERATOR_ID = 0x5,
  MESSAGE_PACK = 0xf,
}

export enum IdType {
  NONE = 0,
  SERIAL_NUMBER = 1,
  CAA_ASSIGNED = 2,
  UTM_ASSIGNED = 3,
  SPECIFIC_SESSION = 4,
}

export enum UaType {
  NONE = 0,
  AEROPLANE = 1,
  HELICOPTER_OR_MULTIROTOR = 2,
  GYROPLANE = 3,
  HYBRID_LIFT = 4,
  ORNITHOPTER = 5,
  GLIDER = 6,
  KITE = 7,
  FREE_BALLOON = 8,
  CAPTIVE_BALLOON = 9,
  AIRSHIP = 10,
  FREE_FALL_PARACHUTE = 11,
  ROCKET = 12,
  TETHERED_POWERED_AIRCRAFT = 13,
  GROUND_OBSTACLE = 14,
  OTHER = 15,
}

export interface AstmBasicId {
  messageType: MessageType.BASIC_ID;
  protoVersion: number;
  idType: IdType;
  uaType: UaType;
  uasId: string;
}

export interface AstmLocation {
  messageType: MessageType.LOCATION_VECTOR;
  protoVersion: number;
  status: number;
  direction: number | null; // degrees (0-359), null when unknown
  speedHorizontal: number; // m/s
  speedVertical: number; // m/s
  latitude: number; // degrees
  longitude: number; // degrees
  altitudeBaro: number | null; // meters, pressure altitude
  altitudeWgs84: number | null; // meters above WGS84 ellipsoid
  heightAboveTakeoff: number | null; // meters above takeoff/ground
  horizontalAccuracy: number | null; // meters (upper bound), null when unknown
  verticalAccuracy: number | null; // meters (upper bound), null when unknown
  speedAccuracy: number | null; // m/s (upper bound), null when unknown
  timestamp: number; // seconds since the hour
}

export interface AstmSystem {
  messageType: MessageType.SYSTEM;
  protoVersion: number;
  operatorLocationType: number;
  operatorLatitude: number; // degrees
  operatorLongitude: number; // degrees
  operatorAltitude: number | null; // meters, null when unknown
  timestamp: number; // seconds since 2019-01-01T00:00:00Z
}

export interface AstmSelfId {
  messageType: MessageType.SELF_ID;
  protoVersion: number;
  descriptionType: number;
  description: string;
}

export interface AstmOperatorId {
  messageType: MessageType.OPERATOR_ID;
  protoVersion: number;
  operatorIdType: number;
  operatorId: string;
}

export interface AstmAuthentication {
  messageType: MessageType.AUTHENTICATION;
  protoVersion: number;
  authType: number;
  pageNumber: number;
  authData: Buffer;
}

export type AstmMessage =
  | AstmBasicId
  | AstmLocation
  | AstmSystem
  | AstmSelfId
  | AstmOperatorId
  | AstmAuthentication;

/** Horizontal accuracy: code -> upper bound in meters (F3411 HorizAcc table). */
const HORIZONTAL_ACCURACY_METERS: Array<number | null> = [
  null, // 0: unknown
  18520, // 1: < 10 NM
  7408, // 2: < 4 NM
  3704, // 3: < 2 NM
  1852, // 4: < 1 NM
  926, // 5: < 0.5 NM
  555.6, // 6: < 0.3 NM
  185.2, // 7: < 0.1 NM
  92.6, // 8: < 0.05 NM
  30, // 9: < 30 m
  10, // 10: < 10 m
  3, // 11: < 3 m
  1, // 12: < 1 m
  null, // 13-15: reserved
  null,
  null,
];

/** Vertical accuracy: code -> upper bound in meters (F3411 VertAcc table). */
const VERTICAL_ACCURACY_METERS: Array<number | null> = [
  null, // 0: unknown
  150, // 1: < 150 m
  45, // 2: < 45 m
  25, // 3: < 25 m
  10, // 4: < 10 m
  3, // 5: < 3 m
  1, // 6: < 1 m
  null, // 7-15: reserved
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

/** Speed accuracy: code -> upper bound in m/s (F3411 SpeedAcc table). */
const SPEED_ACCURACY_MS: Array<number | null> = [
  null, // 0: unknown
  10, // 1: < 10 m/s
  3, // 2: < 3 m/s
  1, // 3: < 1 m/s
  0.3, // 4: < 0.3 m/s
  null, // 5-15: reserved
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

/**
 * ASTM F3411 Message Parser
 */
export class AstmF3411Parser {
  static readonly MESSAGE_LENGTH = 25;

  /** BLE service data application code for UUID 0xFFFA Remote ID broadcasts. */
  private static readonly BLE_APP_CODE = 0x0d;

  /** Altitude fields use uint16 * 0.5m - 1000m; encoded 0 means unknown. */
  private static readonly ALTITUDE_UNKNOWN = -1000;

  /**
   * Parse the payload of a BLE 0xFFFA service data advertisement.
   *
   * Handles the optional [0x0D app code, message counter] prefix, single
   * messages (BT4 legacy advertising), and Message Packs (BT5 extended
   * advertising). Returns all successfully decoded messages.
   */
  static parseAdvertisement(data: Buffer): AstmMessage[] {
    if (!data || data.length === 0) {
      return [];
    }

    let payload = data;
    if (payload.readUInt8(0) === this.BLE_APP_CODE && payload.length >= 2) {
      payload = payload.subarray(2);
    }

    if (payload.length < this.MESSAGE_LENGTH) {
      return [];
    }

    if (payload.readUInt8(0) >> 4 === MessageType.MESSAGE_PACK) {
      return this.parseMessagePack(payload);
    }

    const message = this.parse(payload.subarray(0, this.MESSAGE_LENGTH));
    return message ? [message] : [];
  }

  /**
   * Parse a Message Pack (type 0xF): 3-byte header (type/version, message
   * size, message count) followed by the packed 25-byte messages.
   */
  static parseMessagePack(buffer: Buffer): AstmMessage[] {
    if (buffer.length < 3) {
      return [];
    }

    const messageSize = buffer.readUInt8(1);
    const messageCount = buffer.readUInt8(2);
    if (messageSize !== this.MESSAGE_LENGTH || messageCount === 0) {
      return [];
    }

    const messages: AstmMessage[] = [];
    for (let i = 0; i < messageCount; i++) {
      const offset = 3 + i * messageSize;
      if (offset + messageSize > buffer.length) {
        break;
      }
      const message = this.parse(buffer.subarray(offset, offset + messageSize));
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Parse a single 25-byte ASTM F3411 message.
   * @returns Parsed message or null if invalid
   */
  static parse(buffer: Buffer): AstmMessage | null {
    if (!buffer || buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const messageType = buffer.readUInt8(0) >> 4;
    const protoVersion = buffer.readUInt8(0) & 0x0f;

    switch (messageType) {
      case MessageType.BASIC_ID:
        return this.parseBasicId(buffer, protoVersion);
      case MessageType.LOCATION_VECTOR:
        return this.parseLocation(buffer, protoVersion);
      case MessageType.SYSTEM:
        return this.parseSystem(buffer, protoVersion);
      case MessageType.SELF_ID:
        return this.parseSelfId(buffer, protoVersion);
      case MessageType.OPERATOR_ID:
        return this.parseOperatorId(buffer, protoVersion);
      case MessageType.AUTHENTICATION:
        return this.parseAuthentication(buffer, protoVersion);
      default:
        return null;
    }
  }

  /**
   * Parse Basic ID message (Type 0x0)
   * Byte 1 packs (IDType << 4) | UAType; bytes 2-21 carry the UAS ID.
   */
  private static parseBasicId(buffer: Buffer, protoVersion: number): AstmBasicId | null {
    const idAndUaType = buffer.readUInt8(1);
    const idType = idAndUaType >> 4;
    const uaType = idAndUaType & 0x0f;

    const uasId = this.parseAsciiString(buffer.subarray(2, 22));
    if (!uasId) {
      return null;
    }

    return {
      messageType: MessageType.BASIC_ID,
      protoVersion,
      idType,
      uaType,
      uasId,
    };
  }

  /**
   * Parse Location/Vector message (Type 0x1)
   *
   * Byte 1: (Status << 4) | (Reserved << 3) | (HeightType << 2) |
   *         (EWDirection << 1) | SpeedMult
   * Bytes 2-4: direction, horizontal speed, vertical speed
   * Bytes 5-12: latitude, longitude (int32 LE, 1e-7 deg)
   * Bytes 13-18: pressure altitude, geodetic altitude, height (uint16 LE,
   *              0.5m units, -1000m offset)
   * Byte 19: (VertAcc << 4) | HorizAcc; Byte 20: (BaroAcc << 4) | SpeedAcc
   * Bytes 21-22: timestamp (uint16 LE, 0.1s since the hour)
   */
  private static parseLocation(buffer: Buffer, protoVersion: number): AstmLocation | null {
    const flags = buffer.readUInt8(1);
    const status = flags >> 4;
    const ewDirection = (flags & 0x02) !== 0;
    const speedMult = (flags & 0x01) !== 0;

    // Direction: 0-179 raw; EW bit adds 180. Raw values > 180 mean unknown.
    const directionRaw = buffer.readUInt8(2);
    let direction: number | null = null;
    if (directionRaw <= 180) {
      direction = directionRaw + (ewDirection ? 180 : 0);
      if (direction === 360) {
        direction = 0;
      }
      if (direction > 359) {
        direction = null;
      }
    }

    const speedRaw = buffer.readUInt8(3);
    const speedHorizontal = speedMult ? speedRaw * 0.75 + 255 * 0.25 : speedRaw * 0.25;
    const speedVertical = buffer.readInt8(4) * 0.5;

    const latRaw = buffer.readInt32LE(5);
    const lonRaw = buffer.readInt32LE(9);
    // 0,0 is the spec's unknown-position sentinel
    if (latRaw === 0 && lonRaw === 0) {
      return null;
    }

    const latitude = latRaw / 1e7;
    const longitude = lonRaw / 1e7;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    const altitudeBaro = this.decodeAltitude(buffer.readUInt16LE(13));
    const altitudeWgs84 = this.decodeAltitude(buffer.readUInt16LE(15));
    const heightAboveTakeoff = this.decodeAltitude(buffer.readUInt16LE(17));

    const accByte19 = buffer.readUInt8(19);
    const accByte20 = buffer.readUInt8(20);
    const horizontalAccuracy = HORIZONTAL_ACCURACY_METERS[accByte19 & 0x0f] ?? null;
    const verticalAccuracy = VERTICAL_ACCURACY_METERS[accByte19 >> 4] ?? null;
    const speedAccuracy = SPEED_ACCURACY_MS[accByte20 & 0x0f] ?? null;

    const timestamp = buffer.readUInt16LE(21) * 0.1;

    return {
      messageType: MessageType.LOCATION_VECTOR,
      protoVersion,
      status,
      direction,
      speedHorizontal,
      speedVertical,
      latitude,
      longitude,
      altitudeBaro,
      altitudeWgs84,
      heightAboveTakeoff,
      horizontalAccuracy,
      verticalAccuracy,
      speedAccuracy,
      timestamp,
    };
  }

  /**
   * Parse System message (Type 0x4)
   *
   * Byte 1: (Reserved << 5) | (ClassificationType << 2) | OperatorLocationType
   * Bytes 2-9: operator latitude, longitude (int32 LE, 1e-7 deg)
   * Bytes 10-16: area count/radius/ceiling/floor
   * Byte 17: EU category/class
   * Bytes 18-19: operator geodetic altitude (uint16 LE, 0.5m units, -1000m offset)
   * Bytes 20-23: timestamp (uint32 LE, seconds since 2019-01-01T00:00:00Z)
   */
  private static parseSystem(buffer: Buffer, protoVersion: number): AstmSystem | null {
    const operatorLocationType = buffer.readUInt8(1) & 0x03;

    const latRaw = buffer.readInt32LE(2);
    const lonRaw = buffer.readInt32LE(6);
    if (latRaw === 0 && lonRaw === 0) {
      return null;
    }

    const operatorLatitude = latRaw / 1e7;
    const operatorLongitude = lonRaw / 1e7;
    if (
      operatorLatitude < -90 ||
      operatorLatitude > 90 ||
      operatorLongitude < -180 ||
      operatorLongitude > 180
    ) {
      return null;
    }

    const operatorAltitude = this.decodeAltitude(buffer.readUInt16LE(18));
    const timestamp = buffer.readUInt32LE(20);

    return {
      messageType: MessageType.SYSTEM,
      protoVersion,
      operatorLocationType,
      operatorLatitude,
      operatorLongitude,
      operatorAltitude,
      timestamp,
    };
  }

  /**
   * Parse Self-ID message (Type 0x3): description type + 23-byte text.
   */
  private static parseSelfId(buffer: Buffer, protoVersion: number): AstmSelfId {
    const descriptionType = buffer.readUInt8(1);
    const description = this.parseAsciiString(buffer.subarray(2, 25));

    return {
      messageType: MessageType.SELF_ID,
      protoVersion,
      descriptionType,
      description: description || '',
    };
  }

  /**
   * Parse Operator ID message (Type 0x5): ID type + 20-byte registration.
   */
  private static parseOperatorId(buffer: Buffer, protoVersion: number): AstmOperatorId {
    const operatorIdType = buffer.readUInt8(1);
    const operatorId = this.parseAsciiString(buffer.subarray(2, 22));

    return {
      messageType: MessageType.OPERATOR_ID,
      protoVersion,
      operatorIdType,
      operatorId: operatorId || '',
    };
  }

  /**
   * Parse Authentication message (Type 0x2)
   * Byte 1 packs (AuthType << 4) | PageNumber; bytes 2-24 carry page data.
   * (Page 0 additionally embeds header fields inside its data; callers that
   * need full auth support must reassemble pages.)
   */
  private static parseAuthentication(buffer: Buffer, protoVersion: number): AstmAuthentication {
    const typeAndPage = buffer.readUInt8(1);

    return {
      messageType: MessageType.AUTHENTICATION,
      protoVersion,
      authType: typeAndPage >> 4,
      pageNumber: typeAndPage & 0x0f,
      authData: Buffer.from(buffer.subarray(2, 25)),
    };
  }

  /**
   * Decode a uint16 altitude/height field (0.5m units, -1000m offset).
   * Encoded 0 (= -1000m) is the spec's unknown sentinel.
   */
  private static decodeAltitude(encoded: number): number | null {
    const meters = encoded * 0.5 + this.ALTITUDE_UNKNOWN;
    return meters === this.ALTITUDE_UNKNOWN ? null : meters;
  }

  /**
   * Parse null-terminated ASCII string from buffer
   */
  private static parseAsciiString(buffer: Buffer): string {
    let end = buffer.indexOf(0);
    if (end === -1) {
      end = buffer.length;
    }

    return buffer.subarray(0, end).toString('ascii').trim();
  }
}
