import dotenv from 'dotenv';
import { normalizeEgyptPhone } from '../src/lib/phone';
import { sendVerificationSms, generateVerificationCode } from '../src/lib/twilio';

dotenv.config({ path: process.cwd() + '/.env' });

async function run() {
  try {
    process.env.DEV_SKIP_SMS = 'true';
    const phones = ['01012345678', '+201012345678', '201012345678', '01000000000', '12345'];
    for (const p of phones) {
      try {
        const n = normalizeEgyptPhone(p);
        console.log('normalize:', p, '=>', n);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('normalize error for', p, ':', message);
      }
    }

    const code = generateVerificationCode();
    console.log('generated code', code);
    const res = await sendVerificationSms('01012345678', code);
    console.log('sendVerificationSms returned:', res);
  } catch (e) {
    console.error('test failed:', e);
  }
}

run().catch(console.error);
