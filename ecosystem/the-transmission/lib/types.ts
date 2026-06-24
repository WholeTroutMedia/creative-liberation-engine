/**
 * The Transmission — Shared Types
 *
 * Local type definitions matching @cle/core's TransmissionArtifact
 * and TransmissionWorldState — no monorepo dependency needed.
 */

export type ArtifactKind =
  | 'radio_log'
  | 'sensor_readout'
  | 'corrupted_file'
  | 'witness_testimony'
  | 'field_report'
  | 'system_alert'
  | 'intercepted_message';

export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  radio_log:            'RADIO LOG',
  sensor_readout:       'SENSOR READOUT',
  corrupted_file:       'CORRUPTED FILE',
  witness_testimony:    'WITNESS TESTIMONY',
  field_report:         'FIELD REPORT',
  system_alert:         'SYSTEM ALERT',
  intercepted_message:  'INTERCEPTED MESSAGE',
};

export interface TransmissionArtifact {
  id: string;
  kind: ArtifactKind;
  timestamp: string;
  receivedAt: string;
  callsign: string;
  subject: string;
  body: string;
  corruption: number;
  worldEpoch: number;
  tags: string[];
  readerInfluence?: string;
  location?: string;
  relatesTo?: string[];
}

export interface TransmissionWorldState {
  epoch: number;
  startedAt: string;
  lastUpdated: string;
  activeFactions: string[];
  dominantTheme: string;
  signalStrength: number;
  artifactCount: number;
  readerCount: number;
  hotLocations: string[];
  readerMemory: string[];
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function formatInWorldTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month:  '2-digit',
      day:    '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(',', '');
  } catch {
    return isoString;
  }
}

/** Apply corruption to text: replace characters with noise based on 0–1 level */
export function applyCorruption(text: string, corruption: number): string {
  if (corruption < 0.3) return text;
  const NOISE = '░▒▓█▪■□▫▬▭◆◇◈◉◎●◐◑◒◓◔◕';
  const chars = text.split('');
  return chars
    .map((ch) => {
      if (ch === ' ' || ch === '\n') return ch;
      return Math.random() < corruption * 0.3
        ? NOISE[Math.floor(Math.random() * NOISE.length)]
        : ch;
    })
    .join('');
}
