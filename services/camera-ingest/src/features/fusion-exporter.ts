import fs from 'fs';
import path from 'path';
import logger from 'pino';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export interface TrackingPoint {
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class FusionExporter {
  /**
   * Generates a tracker CSV that can be imported directly into DaVinci Resolve Fusion's Tracker node.
   * DaVinci's Fusion tracker CSV expects headers: "Frame", "X Path", "Y Path"
   */
  public generateResolveTrackerCsv(points: TrackingPoint[]): string {
    let csv = 'Frame,X Path,Y Path,Width Path,Height Path\n';
    
    points.forEach(pt => {
      // Resolve tracker coordinates are typically normalized between 0.0 and 1.0
      // Frame numbers are 0-indexed
      csv += `${pt.frame},${pt.x.toFixed(6)},${pt.y.toFixed(6)},${pt.width.toFixed(6)},${pt.height.toFixed(6)}\n`;
    });

    return csv;
  }

  /**
   * Writes the tracker CSV sidecar file to the processed directory alongside the media asset
   */
  public writeTrackerFile(points: TrackingPoint[], outputDir: string, baseName: string): string | null {
    if (points.length === 0) return null;

    const outputPath = path.join(outputDir, `${baseName}_tracker.csv`);
    try {
      const csvContent = this.generateResolveTrackerCsv(points);
      fs.writeFileSync(outputPath, csvContent);
      log.info(`[FUSION_EXPORTER] Successfully exported Resolve Tracker CSV: ${outputPath}`);
      return outputPath;
    } catch (err: any) {
      log.error(`[FUSION_EXPORTER] Failed to write tracker file: ${err.message}`);
      return null;
    }
  }
}
