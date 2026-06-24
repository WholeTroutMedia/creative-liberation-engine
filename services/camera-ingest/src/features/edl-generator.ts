import fs from 'fs';
import path from 'path';
import logger from 'pino';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export interface EdlEvent {
  filename: string;
  reelName: string;
  timecodeIn: string; // e.g. "01:00:00:00"
  timecodeOut: string; // e.g. "01:00:10:00"
  timelineIn: string;
  timelineOut: string;
}

export class EdlGenerator {
  /**
   * Generates a standard CMX 3600 ASCII Edit Decision List
   */
  public generateCMX3600(events: EdlEvent[], title = 'ALPON_EDGE_CUT'): string {
    let edl = `TITLE: ${title}\nFCM: DROP FRAME\n\n`;

    events.forEach((evt, idx) => {
      const num = String(idx + 1).padStart(3, '0');
      // Format: EventNum Reel Track EditType SourceIn SourceOut TimelineIn TimelineOut
      edl += `${num}  ${evt.reelName.substring(0, 8).padEnd(8)} V     C        `;
      edl += `${evt.timecodeIn} ${evt.timecodeOut} ${evt.timelineIn} ${evt.timelineOut}\n`;
      edl += `* FROM CLIP NAME: ${evt.filename}\n\n`;
    });

    return edl;
  }

  /**
   * Generates FCP XML (XMEML) format for easy import to Premiere, DaVinci, or FCP
   */
  public generateFcpXml(events: EdlEvent[], sequenceName = 'Alpon Edge Ingest Sync'): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml SYSTEM "http://www.apple.com/dtds/xmeml-1.0.dtd">
<xmeml version="4">
  <sequence id="seq_1">
    <name>${sequenceName}</name>
    <duration>3600</duration>
    <rate>
      <timebase>24</timebase>
      <ntsc>TRUE</ntsc>
    </rate>
    <media>
      <video>
        <track>`;

    events.forEach((evt, idx) => {
      xml += `
          <clipitem id="clip_${idx}">
            <name>${evt.filename}</name>
            <duration>240</duration>
            <rate>
              <timebase>24</timebase>
            </rate>
            <in>0</in>
            <out>240</out>
            <start>${idx * 240}</start>
            <end>${(idx + 1) * 240}</end>
            <file id="file_${idx}">
              <name>${evt.filename}</name>
              <pathurl>file://localhost/processed/${evt.filename}</pathurl>
            </file>
          </clipitem>`;
    });

    xml += `
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

    return xml;
  }

  /**
   * Writes the EDL and XML records directly to the processed dropzone folder
   */
  public writeTimelineFiles(events: EdlEvent[], outputDir: string, baseName: string): void {
    const cleanBase = path.join(outputDir, baseName);
    
    try {
      const edlContent = this.generateCMX3600(events);
      fs.writeFileSync(`${cleanBase}.edl`, edlContent);
      log.info(`[EDL_GENERATOR] Saved CMX 3600 EDL: ${cleanBase}.edl`);

      const xmlContent = this.generateFcpXml(events);
      fs.writeFileSync(`${cleanBase}.xml`, xmlContent);
      log.info(`[EDL_GENERATOR] Saved FCP XML: ${cleanBase}.xml`);
    } catch (err: any) {
      log.error(`[EDL_GENERATOR] Failed to write timeline files: ${err.message}`);
    }
  }
}
