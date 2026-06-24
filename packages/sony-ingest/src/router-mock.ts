import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// A mock script to simulate the Zero-Day Intake Router dropping a 
// Siri voice note context payload into the incoming directory.

const INCOMING_DIR = process.env.SONY_INGEST_INCOMING_DIR || path.join(__dirname, '../test/incoming');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function dropMockPayload(eventName: string, timeOffsetMinutes: number = 0) {
  ensureDir(INCOMING_DIR);

  // Calculate the anchor time (now + offset)
  const anchorTime = new Date(Date.now() + (timeOffsetMinutes * 60 * 1000));
  const id = crypto.randomUUID().split('-')[0];
  const filename = `ctx_${anchorTime.getTime()}_${id}.json`;

  const payload = {
    _type: 'context_payload',
    id: id,
    timestamp: anchorTime.toISOString(),
    timestampMs: anchorTime.getTime(),
    source: 'siri_shortcut',
    intent: 'content_context',
    transcription: `We are about to shoot the ${eventName}. We need a quick 30s cut for socials today.`,
    eventSlug: eventName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
    gravityWell: {
      preMinutes: 15,
      postMinutes: 30
    }
  };

  const filePath = path.join(INCOMING_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  
  console.log(`[router-mock] Dropped anchor payload for '${eventName}'`);
  console.log(`[router-mock] Time: ${anchorTime.toISOString()}`);
  console.log(`[router-mock] File: ${filePath}`);
}

const args = process.argv.slice(2);
const eventName = args[0] || 'Brooks_Interview';
const offset = parseInt(args[1] || '0', 10);

dropMockPayload(eventName, offset);
