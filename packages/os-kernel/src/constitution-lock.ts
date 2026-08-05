import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class ConstitutionLock {
  private static readonly PASSWORD = process.env.CLE_UNLOCK_PASSWORD || '';
  
  /**
   * Enforces the Quantum Level Lock around the CLE Constitution.
   * Decrypts the Constitution using AES-256-GCM and the user-provided password.
   * If the correct password is not provided via CLE_UNLOCK_PASSWORD, the OS will halt.
   */
  public static verifyOrHalt(): string {
    const encPath = path.join(__dirname, 'CONSTITUTION.enc');
    if (!fs.existsSync(encPath)) {
      console.error('[FATAL] CONSTITUTION.enc not found. System integrity compromised.');
      process.exit(1);
    }
    
    try {
      const payload = JSON.parse(fs.readFileSync(encPath, 'utf8'));
      const salt = Buffer.from(payload.salt, 'hex');
      const iv = Buffer.from(payload.iv, 'hex');
      const authTag = Buffer.from(payload.authTag, 'hex');
      
      const key = crypto.scryptSync(this.PASSWORD, salt, 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('[SYSTEM] Quantum Lock disengaged. Constitution decrypted successfully.');
      return decrypted;
    } catch (e) {
      console.error('\n[FATAL] QUANTUM LOCK ENFORCED.');
      console.error('The CLE Constitution is locked. Execution halted.');
      console.error('Provide the correct CLE_UNLOCK_PASSWORD to boot the OS.\n');
      process.exit(1);
    }
  }
}

