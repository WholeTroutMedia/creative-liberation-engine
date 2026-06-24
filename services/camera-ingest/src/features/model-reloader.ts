import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from 'pino';
import axios from 'axios';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class ModelReloader {
  private modelPath: string;

  constructor(modelPath = '/opt/sixfab-dx/yolov5s_ppu.dxnn') {
    this.modelPath = modelPath;
  }

  /**
   * Over-the-air hot reload trigger.
   * Downloads new model weights, validates checksum, and updates the local .dxnn file.
   * Because inference.py is spawned per-image, updates are active instantly.
   */
  public async hotSwapModel(downloadUrl: string, expectedChecksum: string): Promise<boolean> {
    log.info(`[MODEL_RELOADER] Preparing hot-swap from ${downloadUrl}`);
    const tempPath = `${this.modelPath}.tmp`;

    try {
      // 1. Download the file
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // 2. Validate checksum
      const hash = crypto.createHash('sha256');
      const fileBuffer = fs.readFileSync(tempPath);
      hash.update(fileBuffer);
      const actualChecksum = hash.digest('hex');

      if (actualChecksum !== expectedChecksum) {
        log.error(`[MODEL_RELOADER] Checksum mismatch! Expected ${expectedChecksum}, got ${actualChecksum}`);
        fs.unlinkSync(tempPath);
        return false;
      }

      // 3. Atomically overwrite
      if (fs.existsSync(this.modelPath)) {
        const backupPath = `${this.modelPath}.bak`;
        fs.renameSync(this.modelPath, backupPath);
      }
      fs.renameSync(tempPath, this.modelPath);

      log.info(`[MODEL_RELOADER] Successfully swapped NPU model. New model is live.`);
      return true;
    } catch (err: any) {
      log.error(`[MODEL_RELOADER] Hot swap failed: ${err.message}`);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return false;
    }
  }
}
