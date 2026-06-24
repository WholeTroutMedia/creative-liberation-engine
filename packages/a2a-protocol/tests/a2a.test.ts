import { describe, it, expect } from "vitest";
import * as net from "net";
import { A2AProtocol, A2APacketType } from "../src/protocol.js";
import { A2ASchemaValidator } from "../src/schema.js";
import { A2ABroker } from "../src/a2a-broker.js";

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

  it("should start the broker and route messages between two agents", async () => {
    const broker = new A2ABroker(5099);
    await broker.start();

    const client1 = new net.Socket();
    const client2 = new net.Socket();

    const client1Received: Buffer[] = [];
    const client2Received: Buffer[] = [];

    const connectClient = (client: net.Socket, port: number) => {
      return new Promise<void>((resolve) => {
        client.connect(port, "127.0.0.1", () => resolve());
      });
    };

    await connectClient(client1, 5099);
    await connectClient(client2, 5099);

    const setupListener = (client: net.Socket, receivedList: Buffer[]) => {
      let buffer = Buffer.alloc(0);
      client.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 8) {
          const len = buffer.readUInt32BE(2);
          if (buffer.length < 8 + len) break;
          const packet = buffer.subarray(0, 8 + len);
          buffer = buffer.subarray(8 + len);
          receivedList.push(packet);
        }
      });
    };

    setupListener(client1, client1Received);
    setupListener(client2, client2Received);

    // Client 1 handshake
    const hs1 = A2AProtocol.serialize(
      A2APacketType.HANDSHAKE_REQ,
      Buffer.from(JSON.stringify({ agentId: "agent-1", version: "1.0.0", capabilities: ["cap-1"], timestamp: Date.now() }))
    );
    client1.write(hs1);

    // Client 2 handshake
    const hs2 = A2AProtocol.serialize(
      A2APacketType.HANDSHAKE_REQ,
      Buffer.from(JSON.stringify({ agentId: "agent-2", version: "1.0.0", capabilities: ["cap-2"], timestamp: Date.now() }))
    );
    client2.write(hs2);

    await new Promise((r) => setTimeout(r, 100));

    expect(client1Received.length).toBe(1);
    expect(client2Received.length).toBe(1);

    const hsRes1 = A2AProtocol.deserialize(client1Received[0]);
    expect(hsRes1.header.packetType).toBe(A2APacketType.HANDSHAKE_RES);

    // Client 1 sends message to Client 2
    const msgPayload = Buffer.from(JSON.stringify({
      senderId: "agent-1",
      receiverId: "agent-2",
      messageId: "msg-001",
      contentType: "text/plain",
      body: "Hello from Agent 1",
      timestamp: Date.now()
    }));
    client1.write(A2AProtocol.serialize(A2APacketType.AGENT_MESSAGE, msgPayload));

    await new Promise((r) => setTimeout(r, 100));

    expect(client2Received.length).toBe(2);
    const msgRes = A2AProtocol.deserialize(client2Received[1]);
    expect(msgRes.header.packetType).toBe(A2APacketType.AGENT_MESSAGE);
    const parsedMsg = JSON.parse(msgRes.payload.toString("utf-8"));
    expect(parsedMsg.body).toBe("Hello from Agent 1");

    client1.destroy();
    client2.destroy();
    await broker.stop();
  });
});

