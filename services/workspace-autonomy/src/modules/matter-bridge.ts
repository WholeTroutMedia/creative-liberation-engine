import WebSocket from "ws";
import pino from "pino";

const logger = pino();

export interface MatterBridgeConfig {
  hassUrl?: string;
  hassToken?: string;
  officeLightEntity?: string;
  panicSwitchEntity?: string;
}

export class MatterBridge {
  private ws: WebSocket | null = null;
  private messageId = 1;
  private authenticated = false;
  private pendingCallbacks: Map<number, (res: any) => void> = new Map();
  private panicCallback: (() => void) | null = null;

  private hassUrl: string;
  private hassToken: string;
  private officeLightEntity: string;
  private panicSwitchEntity: string;
  private isConnecting = false;

  constructor(config: MatterBridgeConfig = {}) {
    // Read from env or config with fallbacks
    const rawUrl = config.hassUrl || process.env.HASS_URL || "http://127.0.0.1:8123";
    this.hassToken = config.hassToken || process.env.HASS_TOKEN || "";
    this.officeLightEntity = config.officeLightEntity || "light.office";
    this.panicSwitchEntity = config.panicSwitchEntity || "switch.automation_go_to_sleep"; // Default panic simulation switch

    // Convert HTTP URL to WebSocket URL
    this.hassUrl = rawUrl.replace(/^http/, "ws") + "/api/websocket";
  }

  /**
   * Connect to Home Assistant WebSocket API
   */
  public async connect(): Promise<boolean> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return this.authenticated;
    }

    this.isConnecting = true;
    logger.info(`[Matter Bridge] Connecting to HASS WebSocket: ${this.hassUrl}`);

    return new Promise((resolve) => {
      this.ws = new WebSocket(this.hassUrl);

      this.ws.on("open", () => {
        logger.info("[Matter Bridge] Socket connection open. Waiting for auth challenge.");
      });

      this.ws.on("message", (rawMsg: string) => {
        try {
          const msg = JSON.parse(rawMsg);
          this.handleIncomingMessage(msg, resolve);
        } catch (err: any) {
          logger.error(`[Matter Bridge] Error parsing HASS message: ${err.message}`);
        }
      });

      this.ws.on("close", () => {
        logger.warn("[Matter Bridge] WebSocket connection closed. Attempting reconnect in 5s.");
        this.authenticated = false;
        this.isConnecting = false;
        setTimeout(() => this.connect(), 5000);
      });

      this.ws.on("error", (err) => {
        logger.error(`[Matter Bridge] WebSocket error: ${err.message}`);
        this.isConnecting = false;
        resolve(false);
      });
    });
  }

  /**
   * Close the WebSocket connection
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
  }

  /**
   * Register a panic switch trigger callback
   */
  public registerPanicCallback(callback: () => void): void {
    this.panicCallback = callback;
    if (this.authenticated) {
      this.subscribeToPanicEvents();
    }
  }

  /**
   * Update ambient light states
   */
  public async setLightState(
    rgb: [number, number, number],
    brightness: number
  ): Promise<any> {
    if (!this.authenticated) {
      logger.warn("[Matter Bridge] Cannot set light state: Not authenticated.");
      return null;
    }

    return this.sendWithResponse({
      type: "call_service",
      domain: "light",
      service: "turn_on",
      service_data: {
        entity_id: this.officeLightEntity,
        rgb_color: rgb,
        brightness: brightness,
      },
    });
  }

  private handleIncomingMessage(msg: any, connectResolve: (val: boolean) => void): void {
    switch (msg.type) {
      case "auth_required":
        logger.info("[Matter Bridge] Authenticating with HASS token...");
        this.ws?.send(
          JSON.stringify({
            type: "auth",
            access_token: this.hassToken,
          })
        );
        break;

      case "auth_ok":
        logger.info("[Matter Bridge] Authentication successful.");
        this.authenticated = true;
        this.isConnecting = false;
        if (this.panicCallback) {
          this.subscribeToPanicEvents();
        }
        connectResolve(true);
        break;

      case "auth_invalid":
        logger.error(`[Matter Bridge] Authentication failed: ${msg.message}`);
        this.authenticated = false;
        this.isConnecting = false;
        connectResolve(false);
        break;

      case "result":
        const cb = this.pendingCallbacks.get(msg.id);
        if (cb) {
          cb(msg.result);
          this.pendingCallbacks.delete(msg.id);
        }
        break;

      case "event":
        this.handleEvent(msg.event);
        break;

      default:
        break;
    }
  }

  private handleEvent(event: any): void {
    if (
      event &&
      event.data &&
      event.data.entity_id === this.panicSwitchEntity &&
      event.data.new_state &&
      event.data.new_state.state === "on"
    ) {
      logger.warn(`[Matter Bridge] Panic trigger detected: ${this.panicSwitchEntity} is ON!`);
      if (this.panicCallback) {
        this.panicCallback();
      }
    }
  }

  private subscribeToPanicEvents(): void {
    logger.info(`[Matter Bridge] Subscribing to panic state events for ${this.panicSwitchEntity}`);
    this.sendWithResponse({
      type: "subscribe_events",
      event_type: "state_changed",
    }).catch((err) => {
      logger.error(`[Matter Bridge] Failed to subscribe to panic events: ${err.message}`);
    });
  }

  private sendWithResponse(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket not open"));
      }

      const id = this.messageId++;
      this.pendingCallbacks.set(id, resolve);

      this.ws.send(
        JSON.stringify({
          id,
          ...payload,
        })
      );
    });
  }
}
