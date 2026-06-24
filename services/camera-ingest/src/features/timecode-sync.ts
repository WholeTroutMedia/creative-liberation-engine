import { exec } from 'child_process';
import { promisify } from 'util';
import logger from 'pino';

const execPromise = promisify(exec);
const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export interface SyncReport {
  timecode: string;
  frameRate: number;
  offsetSeconds: number;
  audioSyncMatches: string[];
}

export class TimecodeSync {
  /**
   * Extracts SMPTE timecode from file headers via ExifTool
   */
  public async extractTimecode(filePath: string): Promise<SyncReport> {
    const defaultReport: SyncReport = {
      timecode: '00:00:00:00',
      frameRate: 23.976,
      offsetSeconds: 0,
      audioSyncMatches: []
    };

    // Query standard timecode tags
    const cmd = `exiftool -TimeCode -FrameRate -json "${filePath}"`;
    log.info(`[TIMECODE_SYNC] Querying SMPTE timecode: ${cmd}`);

    try {
      const { stdout } = await execPromise(cmd);
      const data = JSON.parse(stdout.trim());
      if (data && data.length > 0) {
        const meta = data[0];
        if (meta.TimeCode) defaultReport.timecode = meta.TimeCode;
        if (meta.FrameRate) defaultReport.frameRate = parseFloat(meta.FrameRate);
        
        // Calculate raw offset seconds since midnight for chronological sync
        const parts = defaultReport.timecode.split(':');
        if (parts.length === 4) {
          const h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const s = parseInt(parts[2], 10);
          defaultReport.offsetSeconds = h * 3600 + m * 60 + s;
        }
      }
    } catch (err: any) {
      log.warn(`[TIMECODE_SYNC] Failed to extract timecode: ${err.message}. Defaulting to timestamps.`);
    }

    return defaultReport;
  }

  /**
   * Stubs an audio transcription task to be queued for Whisper
   */
  public generateWhisperJob(filePath: string, mediaChecksum: string): any {
    return {
      task: 'audio_transcription',
      target_file: filePath,
      checksum: mediaChecksum,
      language: 'en',
      model: 'whisper-tiny',
      queued_at: new Date().toISOString()
    };
  }
}
