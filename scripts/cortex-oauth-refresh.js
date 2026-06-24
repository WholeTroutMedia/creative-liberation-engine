import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Load .env
function loadEnv() {
  const envPath = path.resolve('.env');
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

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
const email = "inquiries@creativeliberationengine.org";
const password = "WholeTroutMedia!2026";

console.log('==================================================');
console.log('   CORTEX Automated OAuth2 Refresh Conductor');
console.log('==================================================');

if (!clientId || !clientSecret) {
  console.error('❌ Error: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET is missing from .env!');
  process.exit(1);
}

// Generate Google OAuth authorization URL
const redirectUri = 'http://localhost:8000';
// Scope does NOT include Gmail since Gmail access is disabled
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

// Start a temporary local web server on port 8000 to catch redirect
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const code = parsedUrl.searchParams.get('code');

  if (code) {
    console.log('✅ Callback received! Exchanging code for tokens...');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Success! CORTEX OAuth code captured. You can close this window.</h1>');

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

      if (!refreshToken) {
        console.error('❌ Error: No refresh_token returned in Google response. Ensure you revoke existing access first, or prompt=consent is working.');
        console.log(tokenData);
        process.exit(1);
      }

      console.log('✅ Successfully obtained new refresh token!');

      // Update .env file
      const envPath = path.resolve('.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');
      
      if (envContent.includes('GMAIL_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/^GMAIL_REFRESH_TOKEN\s*=\s*.*$/m, `GMAIL_REFRESH_TOKEN="${refreshToken}"`);
      } else {
        envContent += `\nGMAIL_REFRESH_TOKEN="${refreshToken}"`;
      }

      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('✅ Updated .env file with new GMAIL_REFRESH_TOKEN.');
      
      server.close(() => {
        console.log('🎉 OAuth Refresh completed successfully!');
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
  console.log('🔄 Server listening on http://localhost:8000...');
  console.log('🚀 Spawning Playwright browser automation to complete Google consent...');
  
  const pyCmd = `python scripts/cortex_oauth_flow.py "${oauthUrl}" "${email}" "${password}"`;
  exec(pyCmd, (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Browser automation script failed:', err.message);
      console.error(stderr);
      server.close();
      process.exit(1);
    }
    console.log(stdout);
  });
});
