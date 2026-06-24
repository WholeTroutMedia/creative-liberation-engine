/**
 * CLE Sovereign A2A (Agent-to-Agent) Core Binary Protocol
 * Implements a lightweight, high-performance, and verifiable packet structure.
 */

export enum A2APacketType {
  HANDSHAKE_REQ = 0x01,
  HANDSHAKE_RES = 0x02,
  CAPABILITY_DECLARE = 0x03,
  AGENT_MESSAGE = 0x04,
  HEARTBEAT = 0x05,
  DISCONNECT = 0x06,
  ERROR = 0xFF
}

export interface A2APacketHeader {
  magicByte: number;      // Must be 0xAA (CLE Magic Frame Indicator)
  packetType: A2APacketType;
  payloadLength: number;  // 32-bit big-endian unsigned integer
  checksum: number;       // 8-bit XOR checksum of the payload
}

export interface A2APacket {
  header: A2APacketHeader;
  payload: Buffer;
}

export class A2AProtocol {
  private static MAGIC_BYTE = 0xAA;

  /**
   * Serialize an A2A message into a binary buffer
   */
  public static serialize(type: A2APacketType, payload: Buffer): Buffer {
    const payloadLength = payload.length;
    const headerBuffer = Buffer.alloc(8); // 1 (magic) + 1 (type) + 4 (length) + 1 (checksum) + 1 (reserved/padding)

    // Calculate 8-bit XOR checksum
    let checksum = 0;
    for (let i = 0; i < payloadLength; i++) {
      checksum ^= payload[i];
    }

    headerBuffer.writeUInt8(this.MAGIC_BYTE, 0);
    headerBuffer.writeUInt8(type, 1);
    headerBuffer.writeUInt32BE(payloadLength, 2);
    headerBuffer.writeUInt8(checksum, 6);
    headerBuffer.writeUInt8(0x00, 7); // Padding byte

    return Buffer.concat([headerBuffer, payload]);
  }

  /**
   * Deserialize a binary buffer into an A2A Packet structure
   */
  public static deserialize(buffer: Buffer): A2APacket {
    if (buffer.length < 8) {
      throw new Error("A2A Protocol Violation: Buffer is too small to contain A2A Header.");
    }

    const magic = buffer.readUInt8(0);
    if (magic !== this.MAGIC_BYTE) {
      throw new Error(`A2A Protocol Violation: Invalid magic byte (Expected 0xAA, got 0x${magic.toString(16).toUpperCase()})`);
    }

    const typeValue = buffer.readUInt8(1);
    const packetType = typeValue in A2APacketType ? (typeValue as A2APacketType) : A2APacketType.ERROR;
    const payloadLength = buffer.readUInt32BE(2);
    const expectedChecksum = buffer.readUInt8(6);

    const payload = buffer.subarray(8, 8 + payloadLength);
    if (payload.length !== payloadLength) {
      throw new Error(`A2A Protocol Violation: Payload length mismatch. Header declared ${payloadLength} bytes, but got ${payload.length}.`);
    }

    // Verify Checksum
    let calculatedChecksum = 0;
    for (let i = 0; i < payload.length; i++) {
      calculatedChecksum ^= payload[i];
    }

    if (calculatedChecksum !== expectedChecksum) {
      throw new Error(`A2A Protocol Violation: Checksum verification failed. Expected 0x${expectedChecksum.toString(16)}, got 0x${calculatedChecksum.toString(16)}`);
    }

    return {
      header: {
        magicByte: magic,
        packetType,
        payloadLength,
        checksum: expectedChecksum
      },
      payload
    };
  }

  /**
   * Helper to format handshake JSON payloads
   */
  public static buildHandshake(agentId: string, version: string, capabilities: string[]): Buffer {
    const handshakeData = {
      agentId,
      version,
      capabilities,
      timestamp: Date.now()
    };
    return Buffer.from(JSON.stringify(handshakeData), "utf-8");
  }
}
