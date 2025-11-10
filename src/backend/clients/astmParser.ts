/**
 * ASTM F3411 Remote ID Message Parser
 *
 * Parses ASTM F3411-22a compliant Remote ID messages from Bluetooth advertisements.
 * Supports all message types: Basic ID, Location/Vector, Authentication, Self-ID,
 * System, and Operator ID.
 *
 * @see https://www.astm.org/f3411-22a.html
 * @see https://www.opendroneid.org/specifications/
 */

export enum MessageType {
  BASIC_ID = 0x0,
  LOCATION_VECTOR = 0x1,
  AUTHENTICATION = 0x2,
  SELF_ID = 0x3,
  SYSTEM = 0x4,
  OPERATOR_ID = 0x5,
}

export enum IdType {
  NONE = 0,
  SERIAL_NUMBER = 1,
  CAA_ASSIGNED = 2,
  UTM_ASSIGNED = 3,
  SPECIFIC_SESSION = 4,
}

export interface AstmBasicId {
  messageType: MessageType.BASIC_ID;
  idType: IdType;
  uasId: string;
}

export interface AstmLocation {
  messageType: MessageType.LOCATION_VECTOR;
  status: number;
  direction: number; // degrees (0-360)
  speedHorizontal: number; // m/s
  speedVertical: number; // m/s
  latitude: number; // degrees
  longitude: number; // degrees
  altitudeWgs84: number; // meters above WGS84 ellipsoid
  heightAboveTakeoff: number; // meters above takeoff
  horizontalAccuracy: number; // meters
  verticalAccuracy: number; // meters
  speedAccuracy: number; // m/s
  timestamp: number; // seconds since hour
}

export interface AstmSystem {
  messageType: MessageType.SYSTEM;
  operatorLocationType: number;
  operatorLatitude: number; // degrees
  operatorLongitude: number; // degrees
  operatorAltitude: number; // meters
  timestamp: number; // seconds since hour
}

export interface AstmSelfId {
  messageType: MessageType.SELF_ID;
  descriptionType: number;
  description: string;
}

export interface AstmOperatorId {
  messageType: MessageType.OPERATOR_ID;
  operatorIdType: number;
  operatorId: string;
}

export interface AstmAuthentication {
  messageType: MessageType.AUTHENTICATION;
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

/**
 * ASTM F3411 Message Parser
 *
 * All messages are 25 bytes:
 * - Byte 0: Message Type (0x0-0x5)
 * - Bytes 1-24: Message-specific payload
 */
export class AstmF3411Parser {
  private static readonly MESSAGE_LENGTH = 25;
  private static readonly INVALID_LAT_LON = 0;
  private static readonly INV_LAT = 0x7fffffff;
  private static readonly INV_LON = 0x7fffffff;

  /**
   * Parse an ASTM F3411 message from a buffer
   * @param buffer - Raw message buffer (must be 25 bytes)
   * @returns Parsed message or null if invalid
   */
  static parse(buffer: Buffer): AstmMessage | null {
    if (!buffer || buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const messageType = buffer.readUInt8(0);

    switch (messageType) {
      case MessageType.BASIC_ID:
        return this.parseBasicId(buffer);
      case MessageType.LOCATION_VECTOR:
        return this.parseLocation(buffer);
      case MessageType.SYSTEM:
        return this.parseSystem(buffer);
      case MessageType.SELF_ID:
        return this.parseSelfId(buffer);
      case MessageType.OPERATOR_ID:
        return this.parseOperatorId(buffer);
      case MessageType.AUTHENTICATION:
        return this.parseAuthentication(buffer);
      default:
        console.warn(`Unknown ASTM message type: 0x${messageType.toString(16)}`);
        return null;
    }
  }

  /**
   * Parse Basic ID message (Type 0x0)
   * Contains UAS identifier (serial number, registration, etc.)
   */
  static parseBasicId(buffer: Buffer): AstmBasicId | null {
    if (buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const idType = buffer.readUInt8(1);
    // Bytes 2-21: UAS ID (20 bytes ASCII, null-terminated)
    const uasIdBuffer = buffer.subarray(2, 22);
    const uasId = this.parseAsciiString(uasIdBuffer);

    if (!uasId) {
      return null;
    }

    return {
      messageType: MessageType.BASIC_ID,
      idType,
      uasId,
    };
  }

  /**
   * Parse Location/Vector message (Type 0x1)
   * Contains position, altitude, speed, and heading
   */
  static parseLocation(buffer: Buffer): AstmLocation | null {
    if (buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const status = buffer.readUInt8(1);
    const direction = buffer.readUInt8(2) * 2; // 0.5 degree units -> degrees
    const speedHorizontal = buffer.readUInt8(3) * 0.25; // 0.25 m/s units
    const speedVertical = buffer.readInt8(4) * 0.5; // 0.5 m/s units (signed)

    // Latitude and longitude in 1e-7 degrees (int32)
    const latRaw = buffer.readInt32LE(5);
    const lonRaw = buffer.readInt32LE(9);

    // Check for invalid coordinates
    if (latRaw === this.INV_LAT || lonRaw === this.INV_LON) {
      return null;
    }

    const latitude = latRaw / 1e7;
    const longitude = lonRaw / 1e7;

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    // Altitude above WGS84 (uint16, 0.5m units, offset -1000m)
    const altRaw = buffer.readUInt16LE(13);
    const altitudeWgs84 = altRaw * 0.5 - 1000;

    // Height above takeoff (uint16, 0.5m units, offset -1000m)
    const heightRaw = buffer.readUInt16LE(15);
    const heightAboveTakeoff = heightRaw * 0.5 - 1000;

    // Accuracy values (encoded, simplified for now)
    const horizontalAccuracy = this.decodeAccuracy(buffer.readUInt8(17));
    const verticalAccuracy = this.decodeAccuracy(buffer.readUInt8(18));
    const speedAccuracy = this.decodeAccuracy(buffer.readUInt8(20));

    // Timestamp in 0.1 second units since the hour
    const timestamp = buffer.readUInt16LE(21) * 0.1;

    return {
      messageType: MessageType.LOCATION_VECTOR,
      status,
      direction,
      speedHorizontal,
      speedVertical,
      latitude,
      longitude,
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
   * Contains operator location and system information
   */
  static parseSystem(buffer: Buffer): AstmSystem | null {
    if (buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const operatorLocationType = buffer.readUInt8(1);

    // Operator latitude and longitude in 1e-7 degrees (int32)
    const latRaw = buffer.readInt32LE(4);
    const lonRaw = buffer.readInt32LE(8);

    // Check for invalid coordinates
    if (latRaw === this.INV_LAT || lonRaw === this.INV_LON) {
      return null;
    }

    const operatorLatitude = latRaw / 1e7;
    const operatorLongitude = lonRaw / 1e7;

    // Validate coordinates
    if (
      operatorLatitude < -90 ||
      operatorLatitude > 90 ||
      operatorLongitude < -180 ||
      operatorLongitude > 180
    ) {
      return null;
    }

    // Operator altitude (int32, 1m units)
    const operatorAltitude = buffer.readInt32LE(16);

    // Timestamp in seconds since hour (uint16)
    const timestamp = buffer.readUInt16LE(20);

    return {
      messageType: MessageType.SYSTEM,
      operatorLocationType,
      operatorLatitude,
      operatorLongitude,
      operatorAltitude,
      timestamp,
    };
  }

  /**
   * Parse Self-ID message (Type 0x3)
   * Contains operator description text
   */
  static parseSelfId(buffer: Buffer): AstmSelfId | null {
    if (buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const descriptionType = buffer.readUInt8(1);
    // Bytes 2-24: Description text (23 bytes ASCII)
    const descriptionBuffer = buffer.subarray(2, 25);
    const description = this.parseAsciiString(descriptionBuffer);

    return {
      messageType: MessageType.SELF_ID,
      descriptionType,
      description: description || '',
    };
  }

  /**
   * Parse Operator ID message (Type 0x5)
   * Contains operator registration number
   */
  static parseOperatorId(buffer: Buffer): AstmOperatorId | null {
    if (buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const operatorIdType = buffer.readUInt8(1);
    // Bytes 2-21: Operator ID (20 bytes ASCII)
    const operatorIdBuffer = buffer.subarray(2, 22);
    const operatorId = this.parseAsciiString(operatorIdBuffer);

    return {
      messageType: MessageType.OPERATOR_ID,
      operatorIdType,
      operatorId: operatorId || '',
    };
  }

  /**
   * Parse Authentication message (Type 0x2)
   * Contains authentication data (multi-page)
   */
  static parseAuthentication(buffer: Buffer): AstmAuthentication | null {
    if (buffer.length < this.MESSAGE_LENGTH) {
      return null;
    }

    const authType = buffer.readUInt8(1);
    const pageNumber = buffer.readUInt8(2);
    // Bytes 3-24: Authentication data (22 bytes)
    const authData = buffer.subarray(3, 25);

    return {
      messageType: MessageType.AUTHENTICATION,
      authType,
      pageNumber,
      authData: Buffer.from(authData),
    };
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

  /**
   * Decode accuracy value from ASTM encoding
   * Simplified version - returns approximate meters
   */
  private static decodeAccuracy(encoded: number): number {
    if (encoded === 0) {
      return 0; // Unknown
    }
    if (encoded === 15) {
      return 18520; // > 18520m
    }

    // Simplified accuracy table (meters)
    const accuracyTable = [
      0, // 0: Unknown
      3, // 1: < 3m
      10, // 2: < 10m
      30, // 3: < 30m
      92.6, // 4: < 92.6m
      185.2, // 5: < 185.2m
      555.6, // 6: < 555.6m
      1852, // 7: < 1852m
      3704, // 8: < 3704m
      7408, // 9: < 7408m
      11112, // 10: < 11112m
      18520, // 11: < 18520m
      18520, // 12: < 18520m
      18520, // 13: < 18520m
      18520, // 14: < 18520m
      18520, // 15: > 18520m
    ];

    return accuracyTable[encoded] || 0;
  }
}
