import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.resolve(__dirname, '../.env');
function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      if (line.trim().startsWith('#') || !line.trim()) return;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
  } catch (err) {
    console.warn('⚠️ Failed to load env file:', err.message);
  }
}

loadEnv();

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

console.log('==================================================');
console.log('   CORTEX Sovereign Google OAuth Authenticator');
console.log('==================================================');

if (!clientId || !clientSecret) {
  console.error('❌ Error: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET is missing from .env!');
  process.exit(1);
}

const redirectUri = 'http://localhost:8000';
const scopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar'
].join(' ');

const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: scopes,
  access_type: 'offline',
  prompt: 'consent'
}).toString();

// Start a temporary local web server on port 8000 to catch redirect code
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const code = parsedUrl.searchParams.get('code');

  if (code) {
    console.log('\n[+] Callback received! Exchanging code for credentials...');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Success! CORTEX OAuth authorization captured. You can close this window now.</h1>');

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        throw new Error(`Token exchange error: ${response.statusText} - ${await response.text()}`);
      }

      const tokenData = await response.json();
      const refreshToken = tokenData.refresh_token;
      const accessToken = tokenData.access_token;

      if (!refreshToken) {
        console.error('❌ Error: No refresh_token returned. Google only sends the refresh_token during the FIRST consent prompt. Please go to your Google Account permissions, revoke access for "Creative Liberation Engine", and run this script again.');
        console.log(tokenData);
        process.exit(1);
      }

      // Write credentials file to NAS credentials directory
      const nasCredsFile = path.resolve(__dirname, '../media_intake/cortex_google_credentials.json');
      const sessionCredsFile = path.resolve(__dirname, '../runtime/session/credentials/inquiries@creativeliberationengine.org.json');
      
      const credentials = {
        token: accessToken,
        refresh_token: refreshToken,
        token_uri: "https://oauth2.googleapis.com/token",
        client_id: clientId,
        client_secret: clientSecret,
        scopes: scopes.split(' '),
        expiry: new Date(Date.now() + 3500 * 1000).toISOString()
      };

      fs.writeFileSync(nasCredsFile, JSON.stringify(credentials, null, 2), 'utf-8');
      console.log(`✅ Saved credentials to NAS: ${nasCredsFile}`);
      
      if (fs.existsSync(path.dirname(sessionCredsFile))) {
        fs.writeFileSync(sessionCredsFile, JSON.stringify(credentials, null, 2), 'utf-8');
        console.log(`✅ Saved credentials to Session: ${sessionCredsFile}`);
      }

      // Also update GMAIL_REFRESH_TOKEN in .env
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('GMAIL_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/^GMAIL_REFRESH_TOKEN\s*=\s*.*$/m, `GMAIL_REFRESH_TOKEN="${refreshToken}"`);
      } else {
        envContent += `\nGMAIL_REFRESH_TOKEN="${refreshToken}"`;
      }
      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('✅ Updated .env file with new refresh token.');

      server.close(() => {
        console.log('\n🎉 SUCCESS! Authentication completed. Cortex is authorized to access Google Drive server-side.');
        process.exit(0);
      });
    } catch (err) {
      console.error('❌ Error during token exchange:', err.message);
      process.exit(1);
    }
  } else {
    res.writeHead(400);
    res.end('No authorization code found in redirect URL.');
  }
});

server.listen(8000, () => {
  console.log('🔄 Local callback server listening on http://localhost:8000...');
  console.log('🚀 Opening Google Sign-In in your default desktop browser...');
  
  // Open the link directly in the user's daily desktop browser
  const cmd = `start "" "${oauthUrl}"`;
  exec(cmd, (err) => {
    if (err) {
      console.log(`\n[!] Could not open browser automatically. Please open this link manually:\n\n${oauthUrl}\n`);
    } else {
      console.log('\n[OK] Opened URL in browser. Please sign in as inquiries@creativeliberationengine.org and approve permissions.');
      console.log('Waiting for callback redirect...');
    }
  });
});
