import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load .env manually so this script works regardless of shell environment
function loadEnv(file = '.env') {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
      val = val.slice(1, -1);
    }
    process.env[key] = process.env[key] ?? val;
  }
}

loadEnv('.env');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY_SID;
const apiSecret = process.env.TWILIO_API_SECRET;

async function check() {
  try {
    if (apiKey && apiSecret) {
      console.log('Using API Key SID + Secret for auth');
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const txt = await res.text();
      console.log('Status:', res.status);
      console.log(txt);
      return;
    }

    if (accountSid && authToken) {
      console.log('Using Account SID + Auth Token for auth');
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const txt = await res.text();
      console.log('Status:', res.status);
      console.log(txt);
      return;
    }

    console.error('No Twilio credentials found in .env');
  } catch (e) {
    console.error('Error checking Twilio auth:', e);
  }
}

check();
