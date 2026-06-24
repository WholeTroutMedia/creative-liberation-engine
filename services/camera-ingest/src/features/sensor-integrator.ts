import fs from 'fs';
import logger from 'pino';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export interface EnvironmentalContext {
  gps: {
    latitude: number;
    longitude: number;
    altitude_m: number;
  } | null;
  sensor_metrics: {
    temperature_c: number;
    acceleration_g: { x: number; y: number; z: number };
  };
}

export class SensorIntegrator {
  private mockGpsPath = '/opt/camera-ingest/sensors/gps.json';

  /**
   * Reads current sensor parameters from local serial ports or simulated telemetry
   */
  public readSensors(): EnvironmentalContext {
    let gps = null;
    let temperature = 21.5; // default comfortable room temp
    let acceleration = { x: 0.0, y: 0.0, z: 1.0 }; // standard gravity alignment

    // 1. Try reading simulated GPS data (which DIT/crews can inject via script)
    if (fs.existsSync(this.mockGpsPath)) {
      try {
        const raw = fs.readFileSync(this.mockGpsPath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.latitude && data.longitude) {
          gps = {
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            altitude_m: parseFloat(data.altitude || '0.0')
          };
        }
        if (data.temperature) temperature = parseFloat(data.temperature);
        if (data.acceleration) acceleration = data.acceleration;
      } catch (e) {}
    } else {
      // Return standard home studio coordinates when in local/studio environment
      gps = {
        latitude: 40.7128, // Mock NYC/Studio base latitude
        longitude: -74.0060,
        altitude_m: 12.5
      };
    }

    log.debug(`[SENSOR_INTEGRATOR] Read complete: GPS=${gps ? `${gps.latitude}, ${gps.longitude}` : 'No GPS'}, Temp=${temperature}C`);

    return {
      gps,
      sensor_metrics: {
        temperature_c: temperature,
        acceleration_g: acceleration
      }
    };
  }
}
