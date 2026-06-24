const http = require('http');
const https = require('https');
const fs = require('fs');
const CLIENT_ID = '759644855630-0g4180798evjold8i8m464iddtjgt87n.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:4444';
const ENV_PATH = 'D:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine-v5\\.env';
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/?code=') && !req.url.startsWith('/code=')) {
    const url2 = new URL(req.url, 'http://localhost:4444');
    const code = url2.searchParams.get('code');
    if (!code) { res.end('Waiting for Google redirect... URL: ' + req.url); return; }
  }
  const url2 = new URL(req.url, 'http://localhost:4444');
  const code = url2.searchParams.get('code') || req.url.split('code=')[1]?.split('&')[0];
  if (!code) { res.end('No code in: ' + req.url); return; }
  const postData = 'code=' + encodeURIComponent(code) + '&client_id=' + encodeURIComponent(CLIENT_ID) + '&client_secret=' + encodeURIComponent(CLIENT_SECRET) + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) + '&grant_type=authorization_code';
  const options = { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } };
  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', d => data += d);
    tokenRes.on('end', () => {
      console.log('Token response:', data);
      const token = JSON.parse(data);
      if (!token.refresh_token) { res.end('ERROR - no refresh_token: ' + data); server.close(); return; }
      let env = fs.readFileSync(ENV_PATH, 'utf-8');
      if (env.includes('GMAIL_REFRESH_TOKEN=')) { env = env.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, 'GMAIL_REFRESH_TOKEN=' + token.refresh_token); }
      else { env += '\nGMAIL_REFRESH_TOKEN=' + token.refresh_token + '\n'; }
      fs.writeFileSync(ENV_PATH, env, 'utf-8');
      console.log('[DONE] GMAIL_REFRESH_TOKEN written to .env');
      res.writeHead(200, {'Content-Type':'text/html'});
      res.end('<html><body style="background:#0a0a0f;color:#f0f0f0;font-family:sans-serif;padding:40px"><h2>Token Captured!</h2><p>GMAIL_REFRESH_TOKEN saved to .env. Email is ready for tonight.</p></body></html>');
      server.close(() => process.exit(0));
    });
  });
  tokenReq.write(postData);
  tokenReq.end();
});
server.listen(4444, () => console.log('[token-gen] Listening on http://localhost:4444'));
