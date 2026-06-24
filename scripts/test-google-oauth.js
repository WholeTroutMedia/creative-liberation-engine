import fs from 'fs';
import path from 'path';

// Manually load .env to avoid 'dotenv' package dependency
function loadEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      // Ignore comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        // Strip surrounding quotes if present
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
  } catch (err) {
    console.warn('⚠️ Could not parse .env file manually:', err.message);
  }
}

loadEnv();

const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

console.log('==================================================');
console.log('   Google OAuth Credential Verification Script');
console.log('==================================================');

let credentialsToTry = [];
if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
  credentialsToTry.push({
    name: 'Gmail Client ID credentials',
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET
  });
}
if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
  credentialsToTry.push({
    name: 'Google OAuth Client ID credentials',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
  });
}

if (credentialsToTry.length === 0 || !refreshToken) {
  console.error('❌ Error: Missing GMAIL_REFRESH_TOKEN or OAuth client credentials in your .env file!');
  console.log('Please ensure these values are populated in the active .env file.');
  process.exit(1);
}

async function runTest() {
  let lastError = null;
  
  for (const creds of credentialsToTry) {
    try {
      console.log(`\n🔄 Requesting OAuth access token using [${creds.name}]...`);
      
      const params = new URLSearchParams();
      params.append('client_id', creds.clientId);
      params.append('client_secret', creds.clientSecret);
      params.append('refresh_token', refreshToken);
      params.append('grant_type', 'refresh_token');

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        throw new Error(`Token refresh failed: ${tokenResponse.statusText} - ${errBody}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      console.log(`✅ Access token retrieved successfully using [${creds.name}]!`);
      
      // Save the winning client credentials to run tests
      process.env.ACTIVE_CLIENT_ID = creds.clientId;
      process.env.ACTIVE_CLIENT_SECRET = creds.clientSecret;
      return await testApis(accessToken);
    } catch (err) {
      console.warn(`⚠️ Attempt with [${creds.name}] failed: ${err.message.split('\n')[0]}`);
      lastError = err;
    }
  }

  console.error('\n❌ All Google API credential sets failed!');
  console.error(`Last Error: ${lastError ? lastError.message : 'Unknown error'}`);
  console.log('\nPotential solutions:');
  console.log('1. Check if the GMAIL_REFRESH_TOKEN in your .env file has expired or been revoked.');
  console.log('2. Ensure that your GCP OAuth app is set to "In Production" or the target email is added as a Test User.');
  console.log('3. Ensure the GCP project has Gmail API, Google Drive API, and Google Calendar API enabled.');
  process.exit(1);
}

async function testApis(accessToken) {
  try {
    console.log('\n🔄 Testing Google Drive API (files.list)...');
    const driveRes = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=3', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!driveRes.ok) {
      const errText = await driveRes.text();
      throw new Error(`Google Drive API failed: ${driveRes.statusText} - ${errText}`);
    }
    const driveFiles = await driveRes.json();
    console.log('✅ Google Drive connection successful!');
    console.log('   Recent files in Drive:');
    (driveFiles.files || []).forEach(f => console.log(`    - ${f.name} (${f.mimeType})`));

    console.log('\n🔄 Testing Google Calendar API (events.list)...');
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=3', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!calRes.ok) {
      const errText = await calRes.text();
      throw new Error(`Google Calendar API failed: ${calRes.statusText} - ${errText}`);
    }
    const events = await calRes.json();
    console.log('✅ Google Calendar connection successful!');
    console.log('   Upcoming events:');
    (events.items || []).forEach(e => console.log(`    - ${e.summary} (${e.start?.dateTime || e.start?.date})`));

    console.log('\n🎉 ALL TESTS PASSED! Credentials are valid and ready.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Google API Test Failed!');
    console.error(`Reason: ${err.message}`);
    console.log('\nPotential solutions:');
    console.log('1. Check if the GMAIL_REFRESH_TOKEN in your .env file has expired or been revoked.');
    console.log('2. Ensure that your GCP OAuth app is set to "In Production" or the target email is added as a Test User.');
    console.log('3. Ensure the GCP project has Gmail API, Google Drive API, and Google Calendar API enabled.');
    process.exit(1);
  }
}

runTest();
