import { execSync } from 'child_process';
import fs from 'fs';

export interface TemporalData {
  creationTimeMs: number | null;
  durationSeconds: number | null;
  source: 'ffprobe' | 'fallback_stat';
}

/**
 * Extracts the absolute internal creation time of a media file via FFprobe.
 * Falls back to filesystem `mtime` if FFprobe fails or metadata is missing.
 */
export function extractCreationTime(filePath: string): TemporalData {
  try {
    // We ask for format metadata specifically to find 'creation_time'
    const result = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
      { timeout: 10000, encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    
    // Check format tags first (common for MP4/MOV)
    let creationTimeString = data.format?.tags?.creation_time;
    
    // Check streams if format tags don't have it
    if (!creationTimeString && data.streams) {
      for (const stream of data.streams) {
        if (stream.tags && stream.tags.creation_time) {
          creationTimeString = stream.tags.creation_time;
          break;
        }
      }
    }

    let creationTimeMs: number | null = null;
    let durationSeconds: number | null = null;

    if (creationTimeString) {
      const date = new Date(creationTimeString);
      if (!isNaN(date.getTime())) {
        creationTimeMs = date.getTime();
      }
    }

    if (data.format && data.format.duration) {
       durationSeconds = parseFloat(data.format.duration);
    }

    if (creationTimeMs !== null) {
      return { creationTimeMs, durationSeconds, source: 'ffprobe' };
    }
    
  } catch (err) {
    console.warn(`[temporal] FFprobe extraction failed for ${filePath}, falling back to fs.stat`);
  }

  // Fallback if ffprobe fails or metadata is completely stripped
  try {
    const stat = fs.statSync(filePath);
    return {
      // Use mtime instead of birthtime because birthtime isn't always reliable across FTP transfers
      creationTimeMs: stat.mtimeMs, 
      durationSeconds: null,
      source: 'fallback_stat'
    };
  } catch (statErr) {
    console.error(`[temporal] Could not stat file ${filePath}:`, statErr);
    return { creationTimeMs: null, durationSeconds: null, source: 'fallback_stat' };
  }
}

/**
 * Calculates if a given target time falls within the defined Gravity Well.
 * @param targetTimeMs The creation time of the media file
 * @param anchorTimeMs The creation time of the voice note / context payload
 * @param preWindowMinutes How many minutes *before* the anchor to include
 * @param postWindowMinutes How many minutes *after* the anchor to include
 */
export function isWithinGravityWell(
  targetTimeMs: number,
  anchorTimeMs: number,
  preWindowMinutes: number = 15,
  postWindowMinutes: number = 30
): boolean {
  const preMs = preWindowMinutes * 60 * 1000;
  const postMs = postWindowMinutes * 60 * 1000;
  
  const windowStart = anchorTimeMs - preMs;
  const windowEnd = anchorTimeMs + postMs;

  return targetTimeMs >= windowStart && targetTimeMs <= windowEnd;
}
