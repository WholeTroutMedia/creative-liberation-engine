import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import logger from 'pino';
import axios from 'axios';

const execPromise = promisify(exec);
const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export type NetworkProfile = 'LAN' | 'TRAVEL_WIFI' | 'LTE' | 'OFFLINE';

export class SyncManager {
  private cacheDir: string;
  private currentProfile: NetworkProfile = 'OFFLINE';
  private dispatchUrl: string;
  private meshPort = 5190;
  private udpSocket: dgram.Socket | null = null;
  private isProcessingOfflineQueue = false;

  constructor(cacheDir: string, dispatchUrl: string) {
    this.cacheDir = cacheDir;
    this.dispatchUrl = dispatchUrl;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    this.setupP2PDiscovery();
  }

  /**
   * Periodically checks and updates the active connectivity profile
   */
  public async detectNetworkProfile(): Promise<NetworkProfile> {
    try {
      const start = Date.now();
      // Test direct connection to CLE Dispatch Server
      await axios.get(`${this.dispatchUrl}/api/status`, { timeout: 1500 });
      const latency = Date.now() - start;

      if (latency < 30) {
        this.currentProfile = 'LAN';
      } else if (latency < 150) {
        this.currentProfile = 'TRAVEL_WIFI';
      } else {
        this.currentProfile = 'LTE';
      }
    } catch (err: any) {
      log.debug(`[SYNC_MANAGER] Network check failed: ${err.message}. Assuming OFFLINE.`);
      this.currentProfile = 'OFFLINE';
    }

    log.info(`[SYNC_MANAGER] Active Sync Profile: ${this.currentProfile}`);
    return this.currentProfile;
  }

  public getProfile(): NetworkProfile {
    return this.currentProfile;
  }

  /**
   * Evaluates if a file should be synced to the NAS based on the active network profile
   */
  public shouldSyncFile(filename: string, isProxy: boolean, isSelected: boolean): boolean {
    if (this.currentProfile === 'OFFLINE') return false;
    if (this.currentProfile === 'LAN') return true; // Sync everything on LAN

    if (this.currentProfile === 'TRAVEL_WIFI') {
      // Sync proxies and selected RAWs/photos
      return isProxy || isSelected;
    }

    if (this.currentProfile === 'LTE') {
      // ONLY sync small proxy files or only metadata (skip raw files completely)
      return isProxy && filename.endsWith('_preview.jpg');
    }

    return false;
  }

  /**
   * Caches an ingestion event locally when offline
   */
  public async cacheEventLocally(eventPayload: any): Promise<void> {
    const eventId = `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const cachePath = path.join(this.cacheDir, `${eventId}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(eventPayload, null, 2));
    log.info(`[SYNC_MANAGER] Cached event locally (offline): ${cachePath}`);
  }

  /**
   * Flushes any offline cached tasks back to the central mesh when connection restores
   */
  public async flushOfflineQueue(): Promise<void> {
    if (this.isProcessingOfflineQueue || this.currentProfile === 'OFFLINE') return;
    this.isProcessingOfflineQueue = true;

    try {
      const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        this.isProcessingOfflineQueue = false;
        return;
      }

      log.info(`[SYNC_MANAGER] Syncing ${files.length} cached events to central mesh...`);
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          await axios.post(`${this.dispatchUrl}/api/tasks`, content, { timeout: 3000 });
          fs.unlinkSync(filePath);
          log.info(`[SYNC_MANAGER] Flushed cached event: ${file}`);
        } catch (err: any) {
          log.warn(`[SYNC_MANAGER] Failed to flush event ${file}: ${err.message}. Retrying later.`);
          break; // Stop flushing if the server goes offline again
        }
      }
    } catch (err: any) {
      log.error(`[SYNC_MANAGER] Error flushing offline queue: ${err.message}`);
    } finally {
      this.isProcessingOfflineQueue = false;
    }
  }

  /**
   * Auto-mirrors files to a local USB external drive if detected
   */
  public async mirrorToUSBDrive(sourceDir: string): Promise<boolean> {
    // Scan standard USB mount locations on Raspberry Pi / Debian
    const possibleMounts = ['/media/alpon/', '/media/root/', '/mnt/usb/'];
    let activeMountPoint = '';

    for (const base of possibleMounts) {
      if (fs.existsSync(base)) {
        try {
          const contents = fs.readdirSync(base);
          if (contents.length > 0) {
            activeMountPoint = path.join(base, contents[0]);
            break;
          }
        } catch (e) {}
      }
    }

    if (!activeMountPoint) {
      log.debug('[SYNC_MANAGER] No USB backup drive detected.');
      return false;
    }

    const backupDir = path.join(activeMountPoint, 'cle-backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const cmd = `rsync -av --ignore-existing "${sourceDir}/" "${backupDir}/"`;
    log.info(`[SYNC_MANAGER] Mirroring to USB backup drive: ${cmd}`);
    try {
      await execPromise(cmd);
      log.info(`[SYNC_MANAGER] USB backup mirror complete: ${backupDir}`);
      return true;
    } catch (err: any) {
      log.error(`[SYNC_MANAGER] USB backup mirror failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Broadcasts availability of a file locally for peer-to-peer mesh sync
   */
  public broadcastP2PFile(filename: string, localPath: string): void {
    if (!this.udpSocket) return;
    const msg = JSON.stringify({
      node: 'ALPON_EDGE',
      file: filename,
      path: localPath,
      timestamp: new Date().toISOString()
    });

    this.udpSocket.send(msg, 0, msg.length, this.meshPort, '255.255.255.255', (err) => {
      if (err) log.warn(`[SYNC_MANAGER] P2P Broadcast fail: ${err.message}`);
      else log.debug(`[SYNC_MANAGER] Emitted P2P discovery ping for: ${filename}`);
    });
  }

  private setupP2PDiscovery(): void {
    try {
      this.udpSocket = dgram.createSocket('udp4');
      this.udpSocket.bind(this.meshPort, () => {
        this.udpSocket?.setBroadcast(true);
        log.info(`[SYNC_MANAGER] P2P Mesh Discovery listener active on port ${this.meshPort}`);
      });

      this.udpSocket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.node !== 'ALPON_EDGE') {
            log.info(`[SYNC_MANAGER] P2P mesh update received from peer ${rinfo.address}: ${data.file}`);
            // P2P Sync code triggers here
          }
        } catch (e) {}
      });
    } catch (err: any) {
      log.warn(`[SYNC_MANAGER] Failed to setup UDP socket for P2P Discovery: ${err.message}`);
    }
  }

  public shutdown(): void {
    if (this.udpSocket) {
      this.udpSocket.close();
    }
  }
}
