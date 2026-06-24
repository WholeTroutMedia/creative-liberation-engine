#!/usr/bin/env npx ts-node
/**
 * Creative Liberation Engine V6 — Identity Index Generator
 *
 * After generating agent certificates, this tool reads each .crt file
 * and builds an identity-index.json that maps agentId → fingerprint.
 *
 * This index is consumed by:
 *   - dispatch middleware (agent-identity-auth.ts) for token/mTLS verification
 *   - monitoring dashboards for cert expiry tracking
 *   - automated rotation scripts
 *
 * Usage:
 *   npx ts-node tools/pki/build-identity-index.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const AGENTS_CERT_DIR = path.join(__dirname, 'agents');
const CA_CERT = path.join(__dirname, 'ca', 'cle-ca.crt');
const INDEX_PATH = path.join(AGENTS_CERT_DIR, 'identity-index.json');
const REGISTRY_PATH = path.resolve(__dirname, '../../runtime/registry/agents.canonical.json');

interface IdentityEntry {
  agentId: string;
  certFingerprint: string;
  publicKeyHash: string;
  issuedAt: string;
  expiresAt: string;
  issuer: string;
  status: 'active' | 'revoked' | 'expired' | 'pending_rotation';
}

interface IdentityIndex {
  version: string;
  generatedAt: string;
  caFingerprint: string;
  agents: IdentityEntry[];
}

function getCertInfo(certPath: string): { fingerprint: string; notBefore: string; notAfter: string; subject: string } | null {
  try {
    const fingerprint = execSync(`openssl x509 -in "${certPath}" -noout -fingerprint -sha256`, { encoding: 'utf-8' })
      .trim()
      .replace('sha256 Fingerprint=', 'SHA256:')
      .replace('SHA256 Fingerprint=', 'SHA256:');

    const dates = execSync(`openssl x509 -in "${certPath}" -noout -dates`, { encoding: 'utf-8' }).trim();
    const subject = execSync(`openssl x509 -in "${certPath}" -noout -subject`, { encoding: 'utf-8' }).trim();

    const notBefore = dates.match(/notBefore=(.+)/)?.[1] || '';
    const notAfter = dates.match(/notAfter=(.+)/)?.[1] || '';

    return { fingerprint, notBefore, notAfter, subject };
  } catch {
    return null;
  }
}

function getPublicKeyHash(certPath: string): string {
  try {
    const hash = execSync(
      `openssl x509 -in "${certPath}" -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -hex`,
      { encoding: 'utf-8', shell: 'powershell.exe' }
    ).trim();
    return hash.replace(/.*=\s*/, '');
  } catch {
    return '';
  }
}

function main(): void {
  if (!fs.existsSync(AGENTS_CERT_DIR)) {
    console.error(`[PKI] Agent cert directory not found: ${AGENTS_CERT_DIR}`);
    console.error('      Run generate-agent-cert.ts --all first.');
    process.exit(1);
  }

  // Get CA fingerprint
  const caInfo = getCertInfo(CA_CERT);
  if (!caInfo) {
    console.error('[PKI] Cannot read CA certificate');
    process.exit(1);
  }

  const certFiles = fs.readdirSync(AGENTS_CERT_DIR).filter(f => f.endsWith('.crt'));
  console.log(`[PKI] Building identity index from ${certFiles.length} certificates...`);

  const agents: IdentityEntry[] = [];

  for (const certFile of certFiles) {
    const agentId = path.basename(certFile, '.crt');
    const certPath = path.join(AGENTS_CERT_DIR, certFile);
    const info = getCertInfo(certPath);

    if (!info) {
      console.warn(`[PKI] ⚠ Cannot read cert for ${agentId} — skipping`);
      continue;
    }

    const pubKeyHash = getPublicKeyHash(certPath);

    const expiryDate = new Date(info.notAfter);
    const isExpired = expiryDate < new Date();

    agents.push({
      agentId,
      certFingerprint: info.fingerprint,
      publicKeyHash: pubKeyHash,
      issuedAt: new Date(info.notBefore).toISOString(),
      expiresAt: expiryDate.toISOString(),
      issuer: 'Creative Liberation Engine Root CA',
      status: isExpired ? 'expired' : 'active',
    });
  }

  const index: IdentityIndex = {
    version: 'v6.1',
    generatedAt: new Date().toISOString(),
    caFingerprint: caInfo.fingerprint,
    agents,
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`[PKI] ✅ Identity index written → ${INDEX_PATH}`);
  console.log(`      ${agents.length} agents indexed, CA: ${caInfo.fingerprint.substring(0, 40)}...`);
}

main();
