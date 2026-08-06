import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
const apiKey = process.env.TWILIO_API_KEY_SID;
const apiSecret = process.env.TWILIO_API_SECRET;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_FROM_NUMBER;
const to = process.env.TEST_TWILIO_TO || '+201012345678';

async function run() {
  try {
    const username = apiKey || accountSid;
    const password = apiSecret || authToken;
    if (!username || !password || !accountSid || !from) {
      console.error('Missing required Twilio config (accountSid/from/credentials)');
      return;
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const body = new URLSearchParams({ To: to, From: from, Body: 'Code-UP test message' });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const txt = await res.text();
    console.log('Status:', res.status);
    console.log(txt);
  } catch (e) {
    console.error('Error sending test message:', e);
  }
}

run();
