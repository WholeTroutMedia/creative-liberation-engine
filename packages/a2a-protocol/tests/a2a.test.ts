import { describe, it, expect } from "vitest";
import { A2AProtocol, A2APacketType } from "../src/protocol.js";
import { A2ASchemaValidator } from "../src/schema.js";

describe("A2A Protocol Coding Suite", () => {
  it("should successfully serialize and deserialize a valid A2A packet", () => {
    const originalText = "AVERI.ATHENA.ACTIVE";
    const payload = Buffer.from(originalText, "utf-8");

    const binary = A2AProtocol.serialize(A2APacketType.AGENT_MESSAGE, payload);
    expect(binary.readUInt8(0)).toBe(0xAA); // Magic byte check

    const decoded = A2AProtocol.deserialize(binary);
    expect(decoded.header.packetType).toBe(A2APacketType.AGENT_MESSAGE);
    expect(decoded.header.payloadLength).toBe(payload.length);
    expect(decoded.payload.toString("utf-8")).toBe(originalText);
  });

  it("should fail deserialization if magic byte is corrupted", () => {
    const rawData = Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(() => A2AProtocol.deserialize(rawData)).toThrow("A2A Protocol Violation: Invalid magic byte");
  });

  it("should fail deserialization if checksum is invalid", () => {
    const payload = Buffer.from("CorruptedData", "utf-8");
    const binary = A2AProtocol.serialize(A2APacketType.AGENT_MESSAGE, payload);
    
    // Corrupt one byte of the payload
    binary[10] = binary[10] ^ 0xFF;

    expect(() => A2AProtocol.deserialize(binary)).toThrow("A2A Protocol Violation: Checksum verification failed");
  });

  it("should validate handshake payload formatting schema rules", () => {
    const validHandshake = {
      agentId: "ath-01",
      version: "6.0.0",
      capabilities: ["routing", "signing"],
      timestamp: Date.now()
    };

    expect(A2ASchemaValidator.validateHandshake(validHandshake)).toBe(true);

    const invalidHandshake = {
      agentId: "ath-01",
      capabilities: "not-an-array"
    };

    expect(A2ASchemaValidator.validateHandshake(invalidHandshake)).toBe(false);
  });
});
