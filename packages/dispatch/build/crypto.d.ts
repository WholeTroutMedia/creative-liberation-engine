/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a URL-safe, base64 encoded string containing the IV, ciphertext, and auth tag.
 * Format: iv.authTag.ciphertext
 */
export declare function encrypt(text: string): string;
/**
 * Decrypt a ciphertext string previously encrypted by this module.
 */
export declare function decrypt(encryptedData: string): string;
