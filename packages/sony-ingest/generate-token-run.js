/**
 * generate-token.js â€” One-time Gmail refresh token generator
 * Run this ONCE before the event to get GMAIL_REFRESH_TOKEN into .env
 * Usage: node generate-token.js
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.resolve(__dirname, '../../../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const CLIENT_ID = getEnv('GMAIL_CLIENT_ID');
const CLIENT_SECRET = getEnv('GMAIL_CLIENT_SECRET');
const REDIRECT_URI = 'http://localhost:3456/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('âŒ GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET not found in .env');
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent('https://mail.google.com/')}&` +
  `access_type=offline&prompt=consent`;

console.log('\n==============================================');
console.log('  Gmail OAuth2 Token Generator');
console.log('==============================================\n');
console.log('1. Opening browser for Google consent...');
console.log('2. Sign in as inquiries@creativeliberationengine.org and click Allow');
console.log('3. Token will be automatically saved to .env\n');

// Open the browser
try {
  execSync(`start "" "${authUrl}"`, { stdio: 'pipe', shell: true });
} catch(e) {
  console.log('Open this URL manually:\n', authUrl);
}

// Start callback server
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.end('Waiting...');
    return;
  }

  const url = new URL(req.url, 'http://localhost:3456');
  const code = url.searchParams.get('code');
  
  if (!code) {
    res.end('No code received');
    return;
  }

  console.log('\n[token-gen] âœ… Auth code received â€” exchanging for refresh token...');
  
  try {
    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    
    const tokenData = await tokenRes.json();
    
    if (!tokenData.refresh_token) {
      console.error('[token-gen] âŒ No refresh_token in response:', JSON.stringify(tokenData, null, 2));
      res.end('Error: no refresh_token returned. Try again.');
      server.close();
      return;
    }
    
    const refreshToken = tokenData.refresh_token;
    console.log(`[token-gen] âœ… Refresh token obtained!`);
    
    // Write to .env
    let updatedEnv = envContent;
    if (updatedEnv.includes('GMAIL_REFRESH_TOKEN=')) {
      updatedEnv = updatedEnv.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, `GMAIL_REFRESH_TOKEN=${refreshToken}`);
    } else {
      updatedEnv += `\nGMAIL_REFRESH_TOKEN=${refreshToken}\n`;
    }
    
    fs.writeFileSync(envPath, updatedEnv, 'utf-8');
    console.log('[token-gen] âœ… GMAIL_REFRESH_TOKEN written to .env');
    console.log('[token-gen] Email delivery is now fully configured for tonight ðŸŽ¬');
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body style="font-family:sans-serif;padding:40px;background:#0a0a0f;color:#f0f0f0">
      <h2>âœ… Token captured!</h2>
      <p>GMAIL_REFRESH_TOKEN has been written to .env</p>
      <p style="color:#63b3ed">Email delivery is now configured for tonight's event. You can close this tab.</p>
    </body></html>`);
    
    server.close(() => {
      console.log('[token-gen] Server closed. You are ready to go! ðŸš€');
      process.exit(0);
    });
    
  } catch (err) {
    console.error('[token-gen] Token exchange failed:', err);
    res.end('Error: ' + err.message);
    server.close();
  }
});

server.listen(3456, () => {
  console.log('[token-gen] Callback server running on http://localhost:3456');
  console.log('[token-gen] Waiting for Google consent...\n');
});

