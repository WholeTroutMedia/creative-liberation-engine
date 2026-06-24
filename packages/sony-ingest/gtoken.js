const http = require('http');
const https = require('https');
const fs = require('fs');

const CLIENT_ID = '759644855630-0g4180798evjold8i8m464iddtjgt87n.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3456/oauth2callback';
const ENV_PATH = 'D:\\\\Google Antigravity\\\\Infusion Engine Brainchild\\\\creative-liberation-engine-v5\\\\.env';

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) { res.end('Waiting for Google redirect...'); return; }
  const url = new URL(req.url, 'http://localhost:3456');
  const code = url.searchParams.get('code');
  if (!code) { res.end('No code'); return; }

  const postData = new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }).toString();
  const options = { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } };
  
  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', d => data += d);
    tokenRes.on('end', () => {
      const token = JSON.parse(data);
      if (!token.refresh_token) { res.end('ERROR: ' + data); server.close(); return; }
      let env = fs.readFileSync(ENV_PATH, 'utf-8');
      if (env.includes('GMAIL_REFRESH_TOKEN=')) { env = env.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, 'GMAIL_REFRESH_TOKEN=' + token.refresh_token); }
      else { env += '\nGMAIL_REFRESH_TOKEN=' + token.refresh_token + '\n'; }
      fs.writeFileSync(ENV_PATH, env, 'utf-8');
      console.log('[token-gen] GMAIL_REFRESH_TOKEN written to .env');
      res.writeHead(200, {'Content-Type':'text/html'});
      res.end('<html><body style="font:sans-serif;background:#0a0a0f;color:#f0f0f0;padding:40px"><h2>Token Captured!</h2><p>GMAIL_REFRESH_TOKEN saved to .env. Close this tab.</p></body></html>');
      server.close(() => process.exit(0));
    });
  });
  tokenReq.write(postData);
  tokenReq.end();
});

server.listen(3456, () => console.log('[token-gen] Listening on port 3456...'));
