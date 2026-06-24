require('dotenv').config({ path: 'D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine-v5/.env' });
const nodemailer = require('nodemailer');

const user = process.env.USER_GOOGLE_EMAIL || process.env.ADMIN_EMAIL || 'inquiries@creativeliberationengine.org';
const pass = process.env.GMAIL_APP_PASSWORD;

console.log('USER:', user);
console.log('PASS SET:', !!pass);

const transport = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass }
});

transport.sendMail({
  from: `"Creative Liberation Engine" <${user}>`,
  to: user,
  subject: '🎬 [TEST] Reel Pipeline — Email Confirmed',
  html: '<h2>Email delivery confirmed ✅</h2><p>The Krista 50th Birthday reel pipeline email is wired and ready for tonight at 10:30pm EDT.</p>'
}).then(r => {
  console.log('SENT ✅ messageId:', r.messageId);
}).catch(e => {
  console.error('FAILED ❌', e.message);
});
