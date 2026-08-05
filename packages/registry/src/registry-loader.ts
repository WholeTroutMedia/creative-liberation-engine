import * as fs from 'node:fs';
import * as path from 'node:path';

export class RegistryManager {
  public static loadSystemStatus() {
    const p = path.join(__dirname, 'system-status.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  public static loadEcosystemManifest() {
    const p = path.join(__dirname, 'ecosystem.manifest.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
}

