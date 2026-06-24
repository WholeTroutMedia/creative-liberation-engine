/**
 * CLE Sovereign A2A Capability & Validation Schemas
 */

export interface HandshakePayload {
  agentId: string;
  version: string;
  capabilities: string[];
  timestamp: number;
  publicKey?: string;
  signature?: string;
}

export interface AgentMessagePayload {
  senderId: string;
  receiverId: string;
  messageId: string;
  contentType: "text/plain" | "application/json" | "application/octet-stream";
  body: string;
  timestamp: number;
  signature?: string;
}

export class A2ASchemaValidator {
  /**
   * Validate Handshake Payload Structure
   */
  public static validateHandshake(payload: any): payload is HandshakePayload {
    if (!payload || typeof payload !== "object") return false;
    if (typeof payload.agentId !== "string" || !payload.agentId) return false;
    if (typeof payload.version !== "string" || !payload.version) return false;
    if (!Array.isArray(payload.capabilities)) return false;
    if (typeof payload.timestamp !== "number") return false;
    return true;
  }

  /**
   * Validate Agent Message Payload Structure
   */
  public static validateMessage(payload: any): payload is AgentMessagePayload {
    if (!payload || typeof payload !== "object") return false;
    if (typeof payload.senderId !== "string" || !payload.senderId) return false;
    if (typeof payload.receiverId !== "string" || !payload.receiverId) return false;
    if (typeof payload.messageId !== "string" || !payload.messageId) return false;
    if (typeof payload.contentType !== "string") return false;
    if (typeof payload.body !== "string") return false;
    if (typeof payload.timestamp !== "number") return false;
    return true;
  }
}
