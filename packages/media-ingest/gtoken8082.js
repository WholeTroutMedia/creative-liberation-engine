const http = require('http');
const https = require('https');
const fs = require('fs');
const CLIENT_ID = '759644855630-0g4180798evjold8i8m464iddtjgt87n.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:8082';
const ENV_PATH = 'D:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine-v5\\.env';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:8082');
  const code = url.searchParams.get('code');
  if (!code) { res.end('Waiting... ' + req.url); return; }
  const postData = 'code=' + encodeURIComponent(code) + '&client_id=' + encodeURIComponent(CLIENT_ID) + '&client_secret=' + encodeURIComponent(CLIENT_SECRET) + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) + '&grant_type=authorization_code';
  const options = { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } };
  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', d => data += d);
    tokenRes.on('end', () => {
      console.log('[token-gen] Response:', data);
      try {
        const token = JSON.parse(data);
        if (!token.refresh_token) { res.end('ERROR - no refresh_token: ' + data); server.close(); return; }
        let env = fs.readFileSync(ENV_PATH, 'utf-8');
        if (env.includes('GMAIL_REFRESH_TOKEN=')) { env = env.replace(/^GMAIL_REFRESH_TOKEN=.*)/m, 'GMAIL_REFRESH_TOKEN=' + token.refresh_token); }
        else { env += '\nGMAIL_REFRESH_TOKEN=' + token.refresh_token + '\n'; }
        fs.writeFileSync(ENV_PATH, env, 'utf-8');
        console.log('[token-gen] SUCCESS — GMAIL_REFRESH_TOKEN written to .env');
        res.writeHead(200, {'Content-Type':'text/html'});
        res.end('<html><body style="background:#0a0a0f;color:#f0f0f0;font-family:sans-serif;padding:40px"><h2>Done!</h2><p>GMAIL_REFRESH_TOKEN saved. Email is wired for tonight.</p></body></html>');
        server.close(() => process.exit(0));
      } catch(e) { res.end('Parse error: ' + e.message + ' | ' + data); server.close(); }
    });
  });
  tokenReq.on('error', e => { res.end('Request error: ' + e.message); server.close(); });
  tokenReq.write(postData);
  tokenReq.end();
});
server.listen(8082, () => console.log('[token-gen] Ready on http://localhost:8082'));
