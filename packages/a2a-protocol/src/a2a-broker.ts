import * as net from "net";
import { A2AProtocol, A2APacketType, A2APacket } from "./protocol.js";
import { A2ASchemaValidator } from "./schema.js";

export class SocketState {
  public buffer: Buffer = Buffer.alloc(0);
  public agentId?: string;
  public capabilities: string[] = [];
  constructor(public socket: net.Socket) {}
}

export class A2ABroker {
  private server: net.Server | null = null;
  private connections: Map<string, SocketState> = new Map();
  private allSockets: Set<SocketState> = new Set();

  constructor(private port: number = 5098) {}

  /**
   * Start the A2A Broker TCP server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        const state = new SocketState(socket);
        this.allSockets.add(state);

        socket.on("data", (chunk) => {
          state.buffer = Buffer.concat([state.buffer, chunk as Buffer]);
          this.processBuffer(state);
        });

        socket.on("end", () => {
          this.cleanupConnection(state);
        });

        socket.on("error", (err) => {
          console.error(`Socket error for agent ${state.agentId || "unknown"}:`, err);
          this.cleanupConnection(state);
        });
      });

      this.server.listen(this.port, "0.0.0.0", () => {
        console.log(`[A2A Broker] Server listening on port ${this.port}`);
        resolve();
      });

      this.server.on("error", (err) => {
        console.error("[A2A Broker] Server error:", err);
        reject(err);
      });
    });
  }

  /**
   * Stop the A2A Broker server and close all client connections
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const state of this.allSockets) {
        state.socket.destroy();
      }
      this.allSockets.clear();
      this.connections.clear();

      if (this.server) {
        this.server.close(() => {
          console.log("[A2A Broker] Server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Process client buffers for complete A2A protocol packets
   */
  private processBuffer(state: SocketState): void {
    while (state.buffer.length >= 8) {
      try {
        const payloadLength = state.buffer.readUInt32BE(2);
        const totalLength = 8 + payloadLength;

        if (state.buffer.length < totalLength) {
          // Wait for more data to arrive
          break;
        }

        const packetBuffer = state.buffer.subarray(0, totalLength);
        state.buffer = state.buffer.subarray(totalLength);

        const packet = A2AProtocol.deserialize(packetBuffer);
        this.handlePacket(state, packet);
      } catch (err) {
        console.error("[A2A Broker] Deserialization error:", err);
        this.sendError(state.socket, (err as Error).message);
        state.socket.destroy();
        this.cleanupConnection(state);
        break;
      }
    }
  }

  /**
   * Route and process deserialized A2A packets
   */
  private handlePacket(state: SocketState, packet: A2APacket): void {
    switch (packet.header.packetType) {
      case A2APacketType.HANDSHAKE_REQ:
        this.handleHandshake(state, packet.payload);
        break;
      case A2APacketType.CAPABILITY_DECLARE:
        this.handleCapabilityDeclare(state, packet.payload);
        break;
      case A2APacketType.AGENT_MESSAGE:
        this.handleAgentMessage(state, packet.payload);
        break;
      case A2APacketType.HEARTBEAT:
        // Echo back heartbeat
        state.socket.write(A2AProtocol.serialize(A2APacketType.HEARTBEAT, Buffer.alloc(0)));
        break;
      case A2APacketType.DISCONNECT:
        state.socket.end();
        this.cleanupConnection(state);
        break;
      default:
        this.sendError(state.socket, "Unsupported packet type");
        break;
    }
  }

  private handleHandshake(state: SocketState, payload: Buffer): void {
    try {
      const data = JSON.parse(payload.toString("utf-8"));
      if (!A2ASchemaValidator.validateHandshake(data)) {
        throw new Error("Invalid handshake format");
      }

      state.agentId = data.agentId;
      state.capabilities = data.capabilities;

      this.connections.set(state.agentId, state);
      console.log(`[A2A Broker] Agent registered: ${state.agentId} with capabilities: ${state.capabilities.join(", ")}`);

      const resPayload = Buffer.from(JSON.stringify({ status: "connected", timestamp: Date.now() }), "utf-8");
      state.socket.write(A2AProtocol.serialize(A2APacketType.HANDSHAKE_RES, resPayload));
    } catch (err) {
      this.sendError(state.socket, `Handshake failed: ${(err as Error).message}`);
    }
  }

  private handleCapabilityDeclare(state: SocketState, payload: Buffer): void {
    if (!state.agentId) {
      this.sendError(state.socket, "Unauthenticated connection. Perform handshake first.");
      return;
    }
    try {
      const data = JSON.parse(payload.toString("utf-8"));
      if (Array.isArray(data.capabilities)) {
        state.capabilities = data.capabilities;
        console.log(`[A2A Broker] Agent ${state.agentId} updated capabilities: ${state.capabilities.join(", ")}`);
      } else {
        throw new Error("Capabilities must be an array of strings");
      }
    } catch (err) {
      this.sendError(state.socket, `Capability declaration failed: ${(err as Error).message}`);
    }
  }

  private handleAgentMessage(state: SocketState, payload: Buffer): void {
    if (!state.agentId) {
      this.sendError(state.socket, "Unauthenticated connection. Perform handshake first.");
      return;
    }
    try {
      const msg = JSON.parse(payload.toString("utf-8"));
      if (!A2ASchemaValidator.validateMessage(msg)) {
        throw new Error("Invalid agent message schema");
      }

      // 1. Direct routing by receiverId
      const directTarget = this.connections.get(msg.receiverId);
      if (directTarget) {
        directTarget.socket.write(A2AProtocol.serialize(A2APacketType.AGENT_MESSAGE, payload));
        return;
      }

      // 2. Routing by capability match
      let routed = false;
      for (const conn of this.connections.values()) {
        if (conn.capabilities.includes(msg.receiverId)) {
          conn.socket.write(A2AProtocol.serialize(A2APacketType.AGENT_MESSAGE, payload));
          routed = true;
        }
      }

      if (!routed) {
        console.warn(`[A2A Broker] Message routing failed. Receiver ID or capability '${msg.receiverId}' is offline.`);
        this.sendError(state.socket, `Destination offline: ${msg.receiverId}`);
      }
    } catch (err) {
      this.sendError(state.socket, `Message routing error: ${(err as Error).message}`);
    }
  }

  private sendError(socket: net.Socket, message: string): void {
    try {
      const payload = Buffer.from(JSON.stringify({ error: message }), "utf-8");
      socket.write(A2AProtocol.serialize(A2APacketType.ERROR, payload));
    } catch (err) {
      console.error("[A2A Broker] Failed to send error packet:", err);
    }
  }

  private cleanupConnection(state: SocketState): void {
    this.allSockets.delete(state);
    if (state.agentId) {
      this.connections.delete(state.agentId);
      console.log(`[A2A Broker] Agent disconnected: ${state.agentId}`);
    }
  }
}
