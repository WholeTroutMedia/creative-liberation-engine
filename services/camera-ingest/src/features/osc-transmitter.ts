import dgram from 'dgram';
import logger from 'pino';
import { NpuTaskType } from './model-registry.js';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export interface OscDetection {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Keypoint {
  name: string;
  x: number;
  y: number;
  confidence: number;
}

export interface Skeleton {
  person_id: number;
  keypoints: Keypoint[];
}

export class OscTransmitter {
  private socket: dgram.Socket;
  private port: number;
  private broadcastIp: string;

  constructor(port = 5005, broadcastIp = '255.255.255.255') {
    this.port = port;
    this.broadcastIp = broadcastIp;
    this.socket = dgram.createSocket('udp4');
    
    this.socket.bind(() => {
      this.socket.setBroadcast(true);
      log.info(`[OSC_TRANSMITTER] Socket initialized. Sending to ${this.broadcastIp}:${this.port}`);
    });
  }

  /**
   * Broadcasts tracking coordinates over UDP, formatted dynamically based on NpuTaskType
   */
  public transmit(taskType: NpuTaskType, data: any): void {
    let payload: any = {
      device_id: 'ALPON_X5_EDGE',
      timestamp: Date.now(),
      type: taskType
    };

    if (taskType === 'object_detection') {
      const detections = data as OscDetection[];
      payload.count = detections.length;
      payload.detections = detections.map(d => ({
        label: d.label,
        conf: d.confidence,
        x: d.x,
        y: d.y,
        w: d.width,
        h: d.height
      }));
    } else if (taskType === 'pose_estimation') {
      const skeletons = data as Skeleton[];
      payload.count = skeletons.length;
      payload.skeletons = skeletons;
    } else if (taskType === 'depth_estimation') {
      const depthGrid = data as number[]; // 16x16 grid (256 values)
      payload.grid_size = Math.sqrt(depthGrid.length);
      payload.depth_values = depthGrid;
    }

    const buffer = Buffer.from(JSON.stringify(payload));

    this.socket.send(buffer, 0, buffer.length, this.port, this.broadcastIp, (err) => {
      if (err) {
        log.warn(`[OSC_TRANSMITTER] Failed to transmit UDP packet: ${err.message}`);
      } else {
        log.debug(`[OSC_TRANSMITTER] Broadcasted tracking packet of type: ${taskType}`);
      }
    });
  }

  public shutdown(): void {
    try {
      this.socket.close();
      log.info('[OSC_TRANSMITTER] Closed socket.');
    } catch (e) {}
  }
}
