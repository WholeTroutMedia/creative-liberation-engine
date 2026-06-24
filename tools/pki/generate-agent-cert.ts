#!/usr/bin/env npx ts-node
/**
 * Creative Liberation Engine V6 — Sovereign PKI: Agent Certificate Generator
 *
 * Generates an identity certificate for a specific agent, signed by the
 * Creative Liberation Engine Root CA. The certificate embeds the agentId as the
 * Common Name (CN) and includes a Subject Alternative Name (SAN) for
 * service-level mTLS verification.
 *
 * Output per agent:
 *   tools/pki/agents/<agentId>.key  — Agent private key
 *   tools/pki/agents/<agentId>.crt  — Agent certificate (signed by CA)
 *   tools/pki/agents/<agentId>.csr  — Certificate Signing Request (intermediate)
 *
 * Usage:
 *   npx ts-node tools/pki/generate-agent-cert.ts <agentId>
 *   npx ts-node tools/pki/generate-agent-cert.ts --all    # Generate for all canonical agents
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PKI_DIR = __dirname;
const CA_KEY = path.join(PKI_DIR, 'ca', 'cle-ca.key');
const CA_CERT = path.join(PKI_DIR, 'ca', 'cle-ca.crt');
const AGENTS_DIR = path.join(PKI_DIR, 'agents');
const REGISTRY_PATH = path.resolve(PKI_DIR, '../../runtime/registry/agents.canonical.json');
const CERT_VALIDITY_DAYS = 365; // 1 year — forces annual rotation

interface AgentEntry {
  agentId: string;
  name: string;
  kind: string;
  status: string;
}

function loadRegistry(): AgentEntry[] {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(`[PKI] Registry not found: ${REGISTRY_PATH}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  return data.agents;
}

function generateCert(agentId: string): void {
  if (!fs.existsSync(CA_KEY) || !fs.existsSync(CA_CERT)) {
    console.error('[PKI] Root CA not found. Run generate-ca.ts first.');
    process.exit(1);
  }

  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
  }

  const keyFile = path.join(AGENTS_DIR, `${agentId}.key`);
  const csrFile = path.join(AGENTS_DIR, `${agentId}.csr`);
  const certFile = path.join(AGENTS_DIR, `${agentId}.crt`);
  const extFile = path.join(AGENTS_DIR, `${agentId}.ext`);

  if (fs.existsSync(certFile)) {
    console.log(`[PKI] ⚠ Cert already exists for ${agentId} — skipping (delete to regenerate)`);
    return;
  }

  const subject = `/C=US/ST=New York/O=Creative Liberation Engine/OU=Agent Identity/CN=${agentId}`;

  // SAN extension config for the agent
  const extContent = [
    'authorityKeyIdentifier=keyid,issuer',
    'basicConstraints=CA:FALSE',
    'keyUsage = digitalSignature, keyEncipherment',
    'extendedKeyUsage = clientAuth, serverAuth',
    `subjectAltName = DNS:${agentId}.cle.local, DNS:${agentId}`,
  ].join('\n');

  fs.writeFileSync(extFile, extContent);

  // Step 1: Generate agent private key (2048-bit RSA — lighter than CA)
  execSync(`openssl genrsa -out "${keyFile}" 2048`, { stdio: 'pipe' });

  // Step 2: Generate CSR
  execSync(
    `openssl req -new -key "${keyFile}" -out "${csrFile}" -subj "${subject}"`,
    { stdio: 'pipe' }
  );

  // Step 3: Sign with CA
  execSync(
    `openssl x509 -req -in "${csrFile}" -CA "${CA_CERT}" -CAkey "${CA_KEY}" -CAcreateserial ` +
    `-out "${certFile}" -days ${CERT_VALIDITY_DAYS} -sha256 -extfile "${extFile}"`,
    { stdio: 'pipe' }
  );

  // Cleanup intermediate files
  fs.unlinkSync(csrFile);
  fs.unlinkSync(extFile);

  // Lock down key permissions
  try { fs.chmodSync(keyFile, 0o600); } catch { /* Windows */ }

  console.log(`[PKI] ✓ ${agentId} → cert:${certFile}`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: generate-agent-cert.ts <agentId | --all>');
    process.exit(1);
  }

  if (args[0] === '--all') {
    const agents = loadRegistry();
    console.log(`[PKI] Generating certs for ${agents.length} canonical agents...`);
    let generated = 0;
    for (const agent of agents) {
      if (agent.status === 'active') {
        generateCert(agent.agentId);
        generated++;
      }
    }
    console.log(`[PKI] ✅ ${generated} agent certificates generated.`);
  } else {
    generateCert(args[0]);
  }
}

main();
