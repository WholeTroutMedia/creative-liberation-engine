#!/usr/bin/env npx ts-node
/**
 * Creative Liberation Engine V6 — Sovereign PKI: Root CA Generator
 *
 * Generates a self-signed Root Certificate Authority for the Creative Liberation Engine
 * mesh. All agent identity certificates are signed by this CA.
 *
 * Output:
 *   tools/pki/ca/cle-ca.key  — CA private key (KEEP SECRET)
 *   tools/pki/ca/cle-ca.crt  — CA certificate (distribute to all nodes)
 *
 * Usage:
 *   npx ts-node tools/pki/generate-ca.ts
 *   # Or via the wrapper script:
 *   node tools/pki/generate-ca.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CA_DIR = path.join(__dirname, 'ca');
const CA_KEY = path.join(CA_DIR, 'cle-ca.key');
const CA_CERT = path.join(CA_DIR, 'cle-ca.crt');
const CA_VALIDITY_DAYS = 3650; // 10 years

const CA_SUBJECT = '/C=US/ST=New York/L=New York/O=Creative Liberation Engine/OU=Sovereign PKI/CN=Creative Liberation Engine Root CA';

function main(): void {
  // Ensure output directory exists
  if (!fs.existsSync(CA_DIR)) {
    fs.mkdirSync(CA_DIR, { recursive: true });
  }

  // Guard against accidental overwrite
  if (fs.existsSync(CA_KEY)) {
    console.error(`[ABORT] CA key already exists at ${CA_KEY}`);
    console.error('        Delete it manually if you want to regenerate. This is a destructive operation.');
    process.exit(1);
  }

  console.log('[PKI] Generating Creative Liberation Engine Root CA...');

  // Step 1: Generate CA private key (4096-bit RSA)
  execSync(`openssl genrsa -out "${CA_KEY}" 4096`, { stdio: 'inherit' });
  console.log(`[PKI] ✓ CA private key → ${CA_KEY}`);

  // Step 2: Generate self-signed CA certificate
  execSync(
    `openssl req -x509 -new -nodes -key "${CA_KEY}" -sha256 -days ${CA_VALIDITY_DAYS} -out "${CA_CERT}" -subj "${CA_SUBJECT}"`,
    { stdio: 'inherit' }
  );
  console.log(`[PKI] ✓ CA certificate  → ${CA_CERT}`);

  // Step 3: Lock down permissions on key file
  try {
    fs.chmodSync(CA_KEY, 0o600);
    console.log('[PKI] ✓ Key permissions set to 600 (owner-only)');
  } catch {
    // Windows doesn't support chmod — skip silently
    console.log('[PKI] ⚠ chmod not available (Windows) — secure key manually');
  }

  console.log('[PKI] ✅ Root CA generation complete.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Copy cle-ca.crt to all mesh nodes (NAS, workstation)');
  console.log('  2. Run generate-agent-cert.ts to create per-agent identity certs');
  console.log('  3. NEVER commit cle-ca.key to version control');
}

main();
