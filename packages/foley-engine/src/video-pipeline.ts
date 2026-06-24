import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoScene {
  videoPath: string;
  durationSeconds?: number;
  startOffset?: number;
  label?: string;
}

export interface VideoPipelineOptions {
  scenes: VideoScene[];
  audioPath?: string;
  audioVolume?: number; // e.g. 0.3 for background audio
  outputPath: string;
}

/**
 * Stitch video scenes and overlay audio track using FFmpeg.
 * Implements the Creative Liberation Engine Video Studio (IEVS) core compilation pipeline.
 */
export async function composeVideo(options: VideoPipelineOptions): Promise<string> {
  const { scenes, audioPath, audioVolume = 0.3, outputPath } = options;

  if (scenes.length === 0) {
    throw new Error('[video-pipeline] No scenes provided for composition');
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`[video-pipeline] Composing video with ${scenes.length} scenes...`);

  // Build inputs and filter complex
  const inputs: string[] = [];
  let filterComplex = '';
  let concatSegmentsStr = '';

  scenes.forEach((scene, index) => {
    inputs.push(`-i "${scene.videoPath}"`);
    concatSegmentsStr += `[${index}:v][${index}:a]`;
  });

  const sceneCount = scenes.length;
  // Concat filter: [0:v][0:a][1:v][1:a]... concat=n=2:v=1:a=1 [v][a]
  filterComplex += `${concatSegmentsStr}concat=n=${sceneCount}:v=1:a=1[v][a]`;

  let finalCmd = '';

  if (audioPath && fs.existsSync(audioPath)) {
    // If background audio is provided, mix it in
    inputs.push(`-i "${audioPath}"`);
    const bgAudioIndex = sceneCount; // background audio input index
    
    // Mix the concatenated audio stream [a] with background audio stream [bgAudioIndex:a]
    filterComplex += `;[${bgAudioIndex}:a]volume=${audioVolume}[bg];[a][bg]amix=inputs=2:duration=first[out_a]`;
    
    finalCmd = `ffmpeg ${inputs.join(' ')} -filter_complex "${filterComplex}" -map "[v]" -map "[out_a]" -c:v libx264 -pix_fmt yuv420p -y "${outputPath}" 2>&1`;
  } else {
    // Simple concat export
    finalCmd = `ffmpeg ${inputs.join(' ')} -filter_complex "${filterComplex}" -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -y "${outputPath}" 2>&1`;
  }

  console.log(`[video-pipeline] Executing FFmpeg command...`);
  try {
    execSync(finalCmd, { stdio: 'pipe' });
    console.log(`[video-pipeline] Video composed successfully → ${outputPath}`);
    return outputPath;
  } catch (err: any) {
    console.error(`[video-pipeline] FFmpeg execution error:`, err.message);
    throw new Error(`[video-pipeline] FFmpeg compilation failed: ${err.message}`);
  }
}
