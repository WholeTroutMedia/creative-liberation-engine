import selfsigned from 'selfsigned';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certsDir = path.resolve(__dirname, '../runtime/security/certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

console.log('[SECURITY] Generating Sovereign PKI root CA and leaf certificates...');

// Generate Root CA with CN only to bypass strict X.509 OID parser errors
const caAttrs = [
  { name: 'commonName', value: 'CLE Sovereign Root CA' }
];

const caPems = await selfsigned.generate(caAttrs, {
  days: 3650,
  keySize: 2048,
  extensions: [{
    name: 'basicConstraints',
    cA: true,
    critical: true
  }]
});

fs.writeFileSync(path.join(certsDir, 'ca.crt'), caPems.cert);
fs.writeFileSync(path.join(certsDir, 'ca.key'), caPems.private);
console.log('  - Root CA generated (ca.crt, ca.key)');

// Generate Client Cert (e.g. for agents to call dispatch)
const clientAttrs = [
  { name: 'commonName', value: 'sovereign-agent-client' }
];

const clientPems = await selfsigned.generate(clientAttrs, {
  days: 365,
  keySize: 2048
});

fs.writeFileSync(path.join(certsDir, 'client.crt'), clientPems.cert);
fs.writeFileSync(path.join(certsDir, 'client.key'), clientPems.private);
console.log('  - Client certificate generated (client.crt, client.key)');

// Generate Server Cert (e.g. for sovereign-coder)
const serverAttrs = [
  { name: 'commonName', value: 'localhost' }
];

const serverPems = await selfsigned.generate(serverAttrs, {
  days: 365,
  keySize: 2048
});

fs.writeFileSync(path.join(certsDir, 'server.crt'), serverPems.cert);
fs.writeFileSync(path.join(certsDir, 'server.key'), serverPems.private);
console.log('  - Server certificate generated (server.crt, server.key)');

console.log('[SECURITY] All certificates written to runtime/security/certs/');
