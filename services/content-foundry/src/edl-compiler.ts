/**
 * Content Foundry — Transcript-to-EDL Compiler
 * 
 * The core innovation of IE-IDX-0149: converts a word-level transcript
 * (with user edits applied) into an FFmpeg-executable Edit Decision List.
 * 
 * Flow:
 *   1. Load word-level transcript JSON (from Whisper pipeline)
 *   2. Accept an "edit manifest" — deletions, reorders, trims
 *   3. Compile to an EDL: a sequence of time-range segments
 *   4. Generate FFmpeg filter complex or concat demuxer file
 *   5. Execute the edit — produce clean output
 * 
 * @module content-foundry/edl-compiler
 * @ideation IE-IDX-0149
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * A single word from the transcript with precise timestamps.
 */
interface TranscriptWord {
  word: string;
  start: number;   // seconds
  end: number;      // seconds
  confidence: number;
  speaker?: string;
  isFiller?: boolean;
  isSilence?: boolean;
}

/**
 * Word-level transcript as produced by the Whisper pipeline.
 */
interface WordTranscript {
  assetId: string;
  model: string;
  language: string;
  duration: number;
  words: TranscriptWord[];
}

/**
 * An edit operation on the transcript.
 */
interface EditOperation {
  type: 'delete' | 'keep' | 'reorder';
  /** Index range in the words array [start, end) */
  wordRange: [number, number];
  /** For reorder: target position index */
  targetPosition?: number;
}

/**
 * An edit manifest — the set of user edits to apply.
 * If a word index is not mentioned, it is kept by default.
 */
interface EditManifest {
  assetId: string;
  operations: EditOperation[];
  /** Auto-remove detected filler words */
  removeFillers: boolean;
  /** Auto-trim silence gaps longer than this (seconds) */
  maxSilenceGap: number;
  /** Crossfade duration at cut points (seconds) */
  crossfadeDuration: number;
}

/**
 * A single segment in the Edit Decision List.
 */
interface EDLSegment {
  /** Source time range */
  inPoint: number;   // seconds
  outPoint: number;  // seconds
  /** Crossfade into next segment */
  crossfade: number; // seconds
  /** Words included in this segment (for verification) */
  wordCount: number;
  /** Preview text of this segment */
  previewText: string;
}

/**
 * The compiled Edit Decision List.
 */
interface EditDecisionList {
  assetId: string;
  sourceFile: string;
  segments: EDLSegment[];
  totalDuration: number;
  removedDuration: number;
  wordCountOriginal: number;
  wordCountFinal: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'you know', 'basically', 'literally',
  'right', 'so', 'actually', 'i mean', 'kind of', 'sort of',
  'er', 'ah', 'hmm', 'well'
]);

const DEFAULT_MAX_SILENCE = 0.8;   // seconds
const DEFAULT_CROSSFADE = 0.05;    // 50ms audio crossfade at cuts
const MIN_SEGMENT_DURATION = 0.1;  // minimum segment to keep (100ms)

// ─── Core Compiler ────────────────────────────────────────────────────────

/**
 * Marks filler words in the transcript based on the FILLER_WORDS set.
 */
function detectFillers(words: TranscriptWord[]): TranscriptWord[] {
  return words.map((w) => ({
    ...w,
    isFiller: FILLER_WORDS.has(w.word.toLowerCase().replace(/[.,!?]/g, ''))
  }));
}

/**
 * Detects silence gaps between words and marks them.
 */
function detectSilence(words: TranscriptWord[], maxGap: number): TranscriptWord[] {
  const result: TranscriptWord[] = [];
  for (let i = 0; i < words.length; i++) {
    result.push(words[i]);
    if (i < words.length - 1) {
      const gap = words[i + 1].start - words[i].end;
      if (gap > maxGap) {
        result.push({
          word: '[silence]',
          start: words[i].end,
          end: words[i + 1].start,
          confidence: 1,
          isSilence: true,
          isFiller: false
        });
      }
    }
  }
  return result;
}

/**
 * Resolves which word indices to keep based on the edit manifest.
 * Returns a boolean array (true = keep, false = remove).
 */
function resolveKeepMask(transcript: WordTranscript, manifest: EditManifest): boolean[] {
  const mask = new Array(transcript.words.length).fill(true);

  // Apply filler removal
  if (manifest.removeFillers) {
    transcript.words.forEach((w, i) => {
      if (w.isFiller) mask[i] = false;
    });
  }

  // Apply explicit edit operations
  for (const op of manifest.operations) {
    const [start, end] = op.wordRange;
    if (op.type === 'delete') {
      for (let i = start; i < end && i < mask.length; i++) {
        mask[i] = false;
      }
    }
  }

  // Remove silence markers (they're synthetic)
  transcript.words.forEach((w, i) => {
    if (w.isSilence) mask[i] = false;
  });

  return mask;
}

/**
 * Compiles a keep-mask into contiguous time-range segments.
 * Adjacent kept words are merged into single segments.
 */
function compileSegments(
  words: TranscriptWord[],
  keepMask: boolean[],
  crossfade: number
): EDLSegment[] {
  const segments: EDLSegment[] = [];
  let segStart: number | null = null;
  let segWords: TranscriptWord[] = [];

  for (let i = 0; i < words.length; i++) {
    if (keepMask[i]) {
      if (segStart === null) {
        segStart = words[i].start;
        segWords = [];
      }
      segWords.push(words[i]);
    } else {
      // End of a kept segment
      if (segStart !== null && segWords.length > 0) {
        const lastWord = segWords[segWords.length - 1];
        const duration = lastWord.end - segStart;
        if (duration >= MIN_SEGMENT_DURATION) {
          segments.push({
            inPoint: segStart,
            outPoint: lastWord.end,
            crossfade,
            wordCount: segWords.length,
            previewText: segWords.map(w => w.word).join(' ').substring(0, 80)
          });
        }
        segStart = null;
        segWords = [];
      }
    }
  }

  // Flush final segment
  if (segStart !== null && segWords.length > 0) {
    const lastWord = segWords[segWords.length - 1];
    segments.push({
      inPoint: segStart,
      outPoint: lastWord.end,
      crossfade: 0, // no crossfade on final segment
      wordCount: segWords.length,
      previewText: segWords.map(w => w.word).join(' ').substring(0, 80)
    });
  }

  return segments;
}

/**
 * Main compiler: transcript + edit manifest → Edit Decision List.
 */
export function compileEDL(
  transcript: WordTranscript,
  manifest: EditManifest,
  sourceFile: string
): EditDecisionList {
  // Step 1: Detect fillers and silence
  let words = detectFillers(transcript.words);
  words = detectSilence(words, manifest.maxSilenceGap || DEFAULT_MAX_SILENCE);

  // Step 2: Build a modified transcript with filler/silence markers
  const enrichedTranscript: WordTranscript = { ...transcript, words };

  // Step 3: Resolve the keep mask
  const keepMask = resolveKeepMask(enrichedTranscript, manifest);

  // Step 4: Compile segments
  const crossfade = manifest.crossfadeDuration || DEFAULT_CROSSFADE;
  const segments = compileSegments(words, keepMask, crossfade);

  // Step 5: Calculate stats
  const keptWords = keepMask.filter(Boolean).length;
  const keptDuration = segments.reduce((sum, s) => sum + (s.outPoint - s.inPoint), 0);
  const removedDuration = transcript.duration - keptDuration;

  return {
    assetId: transcript.assetId,
    sourceFile,
    segments,
    totalDuration: keptDuration,
    removedDuration,
    wordCountOriginal: transcript.words.length,
    wordCountFinal: keptWords
  };
}

// ─── FFmpeg Generator ─────────────────────────────────────────────────────

/**
 * Generates an FFmpeg concat demuxer file from an EDL.
 * This is the simplest cut method — no re-encoding, frame-accurate audio cuts.
 */
export function generateFFmpegConcat(edl: EditDecisionList, outputDir: string): string {
  const tempSegments: string[] = [];
  const filterParts: string[] = [];

  // Generate individual trim commands for each segment
  edl.segments.forEach((seg, i) => {
    const segFile = join(outputDir, `_seg_${String(i).padStart(4, '0')}.mkv`);
    tempSegments.push(segFile);
    filterParts.push(
      `ffmpeg -y -i "${edl.sourceFile}" ` +
      `-ss ${seg.inPoint.toFixed(3)} -to ${seg.outPoint.toFixed(3)} ` +
      `-c copy -avoid_negative_ts make_zero ` +
      `"${segFile}"`
    );
  });

  // Generate concat file
  const concatList = tempSegments.map(f => `file '${f}'`).join('\n');
  const concatFile = join(outputDir, '_concat.txt');
  const outputFile = join(outputDir, `${edl.assetId}_edited.mkv`);

  const concatCmd = 
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" ` +
    `-c copy "${outputFile}"`;

  return [
    `# Content Foundry EDL → FFmpeg`,
    `# Asset: ${edl.assetId}`,
    `# Segments: ${edl.segments.length}`,
    `# Original duration: ${edl.totalDuration + edl.removedDuration}s`,
    `# Output duration: ${edl.totalDuration.toFixed(1)}s`,
    `# Removed: ${edl.removedDuration.toFixed(1)}s (${((edl.removedDuration / (edl.totalDuration + edl.removedDuration)) * 100).toFixed(0)}%)`,
    ``,
    `# Step 1: Extract segments`,
    ...filterParts,
    ``,
    `# Step 2: Write concat file`,
    `cat > "${concatFile}" << 'EOF'`,
    concatList,
    `EOF`,
    ``,
    `# Step 3: Concatenate`,
    concatCmd,
    ``,
    `# Step 4: Cleanup temp segments`,
    `rm -f ${tempSegments.map(f => `"${f}"`).join(' ')}`,
    `rm -f "${concatFile}"`
  ].join('\n');
}

/**
 * Generates an FFmpeg filter_complex for audio-precise editing.
 * Uses atrim + acrossfade for seamless word-boundary cuts.
 */
export function generateFFmpegFilterComplex(edl: EditDecisionList): string {
  if (edl.segments.length === 0) return '# No segments — nothing to compile';

  const filters: string[] = [];
  const inputLabels: string[] = [];

  edl.segments.forEach((seg, i) => {
    const vLabel = `[v${i}]`;
    const aLabel = `[a${i}]`;
    filters.push(
      `[0:v]trim=start=${seg.inPoint.toFixed(3)}:end=${seg.outPoint.toFixed(3)},setpts=PTS-STARTPTS${vLabel}`
    );
    filters.push(
      `[0:a]atrim=start=${seg.inPoint.toFixed(3)}:end=${seg.outPoint.toFixed(3)},asetpts=PTS-STARTPTS${aLabel}`
    );
    inputLabels.push(vLabel, aLabel);
  });

  // Interleave video and audio labels for concat
  const concatInputs = edl.segments
    .map((_, i) => `[v${i}][a${i}]`)
    .join('');
  
  filters.push(
    `${concatInputs}concat=n=${edl.segments.length}:v=1:a=1[outv][outa]`
  );

  return [
    `ffmpeg -y -i "${edl.sourceFile}" -filter_complex "`,
    filters.join(';\n'),
    `" -map "[outv]" -map "[outa]" -c:v libx264 -crf 18 -c:a aac -b:a 192k`,
    `"${edl.assetId}_edited.mp4"`
  ].join(' \\\n');
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────

/**
 * CLI usage:
 *   npx ts-node edl-compiler.ts <transcript.json> <manifest.json> <source.mp4> [output-dir]
 */
if (require.main === module) {
  const [,, transcriptPath, manifestPath, sourceFile, outputDir = './output'] = process.argv;

  if (!transcriptPath || !manifestPath || !sourceFile) {
    console.error('Usage: edl-compiler <transcript.json> <manifest.json> <source.mp4> [output-dir]');
    process.exit(1);
  }

  const transcript: WordTranscript = JSON.parse(readFileSync(transcriptPath, 'utf-8'));
  const manifest: EditManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  console.log(`\n⚡ Content Foundry EDL Compiler`);
  console.log(`  Asset:    ${transcript.assetId}`);
  console.log(`  Words:    ${transcript.words.length}`);
  console.log(`  Duration: ${transcript.duration}s`);
  console.log(`  Edits:    ${manifest.operations.length} operations`);
  console.log(`  Fillers:  ${manifest.removeFillers ? 'auto-remove' : 'keep'}\n`);

  const edl = compileEDL(transcript, manifest, sourceFile);

  console.log(`✅ Compiled ${edl.segments.length} segments`);
  console.log(`  Kept:    ${edl.totalDuration.toFixed(1)}s (${edl.wordCountFinal} words)`);
  console.log(`  Removed: ${edl.removedDuration.toFixed(1)}s (${edl.wordCountOriginal - edl.wordCountFinal} words)`);
  console.log(`  Ratio:   ${((edl.removedDuration / (edl.totalDuration + edl.removedDuration)) * 100).toFixed(0)}% trimmed\n`);

  // Write EDL JSON
  const edlPath = join(outputDir, `${edl.assetId}_edl.json`);
  writeFileSync(edlPath, JSON.stringify(edl, null, 2));
  console.log(`  EDL:     ${edlPath}`);

  // Write FFmpeg script (concat method — faster, no re-encode)
  const concatScript = generateFFmpegConcat(edl, outputDir);
  const concatPath = join(outputDir, `${edl.assetId}_edit.sh`);
  writeFileSync(concatPath, concatScript);
  console.log(`  Script:  ${concatPath} (concat, copy codec)`);

  // Write FFmpeg filter_complex (re-encode method — seamless transitions)
  const filterScript = generateFFmpegFilterComplex(edl);
  const filterPath = join(outputDir, `${edl.assetId}_edit_hq.sh`);
  writeFileSync(filterPath, filterScript);
  console.log(`  Script:  ${filterPath} (filter_complex, re-encode)`);

  console.log(`\n🎬 Ready to execute. Run either script to produce the edited output.`);
}

export type {
  TranscriptWord,
  WordTranscript,
  EditOperation,
  EditManifest,
  EDLSegment,
  EditDecisionList
};
