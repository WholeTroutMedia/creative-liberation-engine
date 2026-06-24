import pkg from 'osc';
const { UDPPort } = pkg;
import { ARKitFrame, ARKIT_BLENDSHAPES } from './types/ARKit.js';

export interface UDPEmitterOptions {
  remoteAddress: string;
  remotePort: number;
  localAddress?: string;
  localPort?: number;
  oscAddressPattern?: string;
}

export class UDPEmitter {
  private port: any;
  private isReady: boolean = false;
  private oscAddressPattern: string;

  constructor(options: UDPEmitterOptions) {
    this.oscAddressPattern = options.oscAddressPattern || '/somatic/arkit';
    
    this.port = new UDPPort({
      localAddress: options.localAddress || '0.0.0.0',
      localPort: options.localPort || 0,
      remoteAddress: options.remoteAddress,
      remotePort: options.remotePort,
      metadata: true
    });

    this.port.on('ready', () => {
      this.isReady = true;
      console.log(`[somatic] OSC UDP Emitter connected. Target: ${options.remoteAddress}:${options.remotePort}`);
    });

    this.port.on('error', (err: any) => {
      console.error(`[somatic] OSC UDP Emitter error:`, err);
    });
  }

  public connect(): void {
    if (!this.isReady) {
      this.port.open();
    }
  }

  public disconnect(): void {
    if (this.isReady) {
      this.port.close();
      this.isReady = false;
    }
  }

  /**
   * Translates an ARKitFrame object into a strictly ordered Float array
   * according to the Apple ARKit 52 index standard, and blasts it to Unreal Engine via OSC.
   */
  public sendFrame(frame: ARKitFrame): void {
    if (!this.isReady) {
      console.warn(`[somatic] Warning: Attempting to send frame before port is ready`);
      return;
    }

    const args = ARKIT_BLENDSHAPES.map((shape) => {
      const value = frame[shape] || 0.0;
      return { type: 'f', value }; // 'f' specifies 32-bit float for OSC metadata
    });

    try {
      this.port.send({
        address: this.oscAddressPattern,
        args
      });
    } catch (e) {
      console.error(`[somatic] Failed to send frame payload:`, e);
    }
  }
}
