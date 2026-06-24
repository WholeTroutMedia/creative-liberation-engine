import logger from 'pino';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export interface AestheticMetrics {
  sharpness: number;  // Laplacian variance
  contrast: number;   // Standard deviation of pixel intensities
  brightness: number; // Mean pixel intensity
}

export interface AestheticResult {
  tags: string[];
  isLowQuality: boolean;
}

export class AestheticTagger {
  private sharpnessThreshold = 100.0;
  private minContrastThreshold = 30.0;
  private lowBrightnessThreshold = 40.0;
  private highBrightnessThreshold = 220.0;

  constructor(
    sharpnessThreshold?: number,
    minContrastThreshold?: number
  ) {
    if (sharpnessThreshold) this.sharpnessThreshold = sharpnessThreshold;
    if (minContrastThreshold) this.minContrastThreshold = minContrastThreshold;
  }

  public analyze(metrics: AestheticMetrics): AestheticResult {
    const tags: string[] = [];
    let isLowQuality = false;

    // 1. Sharpness (Laplacian variance test)
    if (metrics.sharpness < this.sharpnessThreshold) {
      tags.push('blurry');
      isLowQuality = true;
    } else {
      tags.push('sharp_focus');
    }

    // 2. Contrast
    if (metrics.contrast < this.minContrastThreshold) {
      tags.push('low_contrast');
      isLowQuality = true;
    } else if (metrics.contrast > 85.0) {
      tags.push('high_contrast');
    }

    // 3. Brightness (Over/Under Exposure)
    if (metrics.brightness < this.lowBrightnessThreshold) {
      tags.push('underexposed');
      isLowQuality = true;
    } else if (metrics.brightness > this.highBrightnessThreshold) {
      tags.push('overexposed');
      isLowQuality = true;
    } else {
      tags.push('balanced_exposure');
    }

    log.info(`[AESTHETIC_TAGGER] Analysis complete. Metrics: ${JSON.stringify(metrics)} -> Tags: ${tags.join(', ')}`);

    return {
      tags,
      isLowQuality
    };
  }
}
