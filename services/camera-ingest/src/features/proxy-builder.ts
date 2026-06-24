import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import logger from 'pino';

const execPromise = promisify(exec);
const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class ProxyBuilder {
  /**
   * Extracts the embedded JPEG preview from a camera RAW file (Sony .ARW, Canon .CR3, Nikon .NEF)
   */
  public async extractRawPreview(rawPath: string, outputDir: string): Promise<string | null> {
    const ext = path.extname(rawPath).toLowerCase();
    if (!['.arw', '.cr3', '.nef', '.dng'].includes(ext)) {
      return null;
    }

    const filename = path.basename(rawPath, ext);
    const outputPath = path.join(outputDir, `${filename}_preview.jpg`);
    
    // We try to extract using ExifTool which is extremely fast and high-res
    // Try PreviewImage first, then JpgFromRaw as fallback
    const cmd = `exiftool -b -PreviewImage "${rawPath}" > "${outputPath}" || exiftool -b -JpgFromRaw "${rawPath}" > "${outputPath}"`;
    
    log.info(`[PROXY_BUILDER] Extracting RAW preview: ${cmd}`);
    try {
      await execPromise(cmd);
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        log.info(`[PROXY_BUILDER] Successfully extracted preview to ${outputPath}`);
        return outputPath;
      }
    } catch (err: any) {
      log.warn(`[PROXY_BUILDER] ExifTool extraction failed: ${err.message}. Trying basic fallback copy.`);
    }

    return null;
  }

  /**
   * Applies a basic LUT simulation (using OpenCV/Pillow inside the Python NPU inference framework)
   */
  public async applyLUT(imagePath: string, lutPath: string, outputPath: string): Promise<string> {
    // Standard Node fallback: If no python execution is specified, just copy the image for now
    // In production, we run the custom color grading code
    log.info(`[PROXY_BUILDER] Applying LUT ${lutPath} to ${imagePath} -> ${outputPath}`);
    try {
      fs.copyFileSync(imagePath, outputPath);
    } catch (err: any) {
      log.error(`[PROXY_BUILDER] Failed to apply LUT: ${err.message}`);
    }
    return outputPath;
  }

  /**
   * Transcodes high-res video clips to highly-compressed H.264 video proxies via FFmpeg
   */
  public async transcodeVideoProxy(videoPath: string, outputPath: string): Promise<string> {
    // Create H.264 proxy, scaling to 640x360, low bitrate
    const cmd = `ffmpeg -y -i "${videoPath}" -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -crf 28 -preset ultrafast -ac 1 -c:a aac -b:a 64k "${outputPath}"`;
    
    log.info(`[PROXY_BUILDER] Transcoding video proxy: ${cmd}`);
    try {
      await execPromise(cmd);
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        log.info(`[PROXY_BUILDER] Successfully transcoded proxy to ${outputPath}`);
        return outputPath;
      }
    } catch (err: any) {
      log.error(`[PROXY_BUILDER] FFmpeg transcoding failed: ${err.message}`);
      throw err;
    }
    return videoPath; // fallback to original if fail
  }
}
