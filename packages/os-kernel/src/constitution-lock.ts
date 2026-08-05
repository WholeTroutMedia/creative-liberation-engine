import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class ConstitutionLock {
  private static readonly EXPECTED_HASH = '380bd16503bafef61d6ecb5edb696aeb3232845a76c024505f96e4f16fae9112'; // SHA-256 of the original constitution
  private static readonly PASSWORD = process.env.CLE_UNLOCK_PASSWORD || '';
  
  /**
   * Enforces the Quantum Level Lock around the CLE Constitution.
   * The OS will boot normally and agents can read the Constitution. 
   * However, if the Constitution has been tampered with or modified, 
   * the system will reject the changes unless the CLE_UNLOCK_PASSWORD is provided to authorize the edit.
   */
  public static verifyIntegrity(): void {
    const constitutionPath = path.join(__dirname, 'CONSTITUTION.md');
    const encPath = path.join(__dirname, 'CONSTITUTION.enc');
    
    // 1. If the constitution file is missing, try to restore it
    if (!fs.existsSync(constitutionPath)) {
      this.restoreConstitution(constitutionPath, encPath);
      return;
    }

    // 2. Check the hash of the current constitution
    const currentContent = fs.readFileSync(constitutionPath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
    
    // 3. If tampered, check for the unlock password to authorize the change
    if (currentHash !== this.EXPECTED_HASH) {
      if (this.PASSWORD === 'WholeTroutMedia!2026_CLEUNLOCK') {
        console.log('[SYSTEM] Quantum Lock disengaged via password. Authorized modifications to the Constitution accepted.');
        // In a full implementation, we would update the enc/hash here.
        return;
      } else {
        console.warn('\n[WARNING] UNAUTHORIZED MODIFICATION TO CLE CONSTITUTION DETECTED.');
        console.warn('The system laws have been tampered with. Overriding unauthorized changes and restoring original axioms...');
        this.restoreConstitution(constitutionPath, encPath);
      }
    } else {
      console.log('[SYSTEM] Constitution integrity verified. Quantum Lock active.');
    }
  }

  private static restoreConstitution(constitutionPath: string, encPath: string): void {
    if (!fs.existsSync(encPath)) {
      console.error('[FATAL] CONSTITUTION.enc backup missing. System integrity critically compromised.');
      process.exit(1);
    }
    
    // We use a hardcoded internal key for the OS to read its own backup, ensuring it can always restore.
    // The user password is only required to *change* it.
    const internalKeyPassword = 'internal_os_read_only_key_99'; 
    try {
      const payload = JSON.parse(fs.readFileSync(encPath, 'utf8'));
      const salt = Buffer.from(payload.salt, 'hex');
      const iv = Buffer.from(payload.iv, 'hex');
      const authTag = Buffer.from(payload.authTag, 'hex');
      
      const key = crypto.scryptSync(internalKeyPassword, salt, 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      fs.writeFileSync(constitutionPath, decrypted, 'utf8');
      console.log('[SYSTEM] Constitution restored to original immutable state.\n');
    } catch (e) {
      console.error('[FATAL] Failed to restore constitution. System halted.');
      process.exit(1);
    }
  }
}

