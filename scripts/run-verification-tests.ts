import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

async function importFresh<T>(specifier: string): Promise<T> {
  const url = new URL(specifier, import.meta.url);
  url.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return import(url.href) as Promise<T>;
}

async function testPhoneNormalization() {
  const { normalizeEgyptPhone, formatDisplayPhone } = await importFresh<typeof import('../src/lib/phone.ts')>('../src/lib/phone.ts');

  assert.equal(normalizeEgyptPhone('01012345678'), '+201012345678');
  assert.equal(normalizeEgyptPhone('+201012345678'), '+201012345678');
  assert.equal(normalizeEgyptPhone('201012345678'), '+201012345678');
  assert.equal(formatDisplayPhone('+201012345678'), '01012345678');
  assert.throws(() => normalizeEgyptPhone('12345'), /رقم الهاتف غير صالح/);
}

async function testDevMockSms() {
  process.env.DEV_SKIP_SMS = 'true';
  process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC00000000000000000000000000000000';
  process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'x'.repeat(32);
  process.env.TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '+201000000000';
  delete process.env.TWILIO_USE_VERIFY;

  const mod = await importFresh<typeof import('../src/lib/twilio.ts')>('../src/lib/twilio.ts');
  const result = await mod.sendVerificationSms('01012345678', '123456');

  assert.equal(result.method, 'dev');
  assert.equal(result.code, '123456');
  assert.equal(result.dev, true);
}

async function testVerifySmsRequestShape() {
  process.env.DEV_SKIP_SMS = 'false';
  process.env.TWILIO_USE_VERIFY = 'true';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA11111111111111111111111111111111';
  process.env.TWILIO_API_KEY_SID = 'SK11111111111111111111111111111111';
  process.env.TWILIO_API_SECRET = 's'.repeat(32);

  const calls: Array<{ url: string; options: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), options: init || {} });
    return new Response(JSON.stringify({ sid: 'VE123', status: 'pending' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const mod = await importFresh<typeof import('../src/lib/twilio.ts')>('../src/lib/twilio.ts');
    const result = await mod.sendVerificationSms('01012345678', '654321');

    assert.equal(result.method, 'verify');
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /verify\.twilio\.com\/v2\/Services\/VA11111111111111111111111111111111\/Verifications$/);

    const body = String(calls[0].options.body || '');
    assert.match(body, /To=%2B201012345678/);
    assert.match(body, /Channel=sms/);

    const auth = String(calls[0].options.headers && (calls[0].options.headers as Record<string, string>).Authorization || '');
    assert.ok(auth.startsWith('Basic '));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testWhatsAppPayloadShape() {
  process.env.WHATSAPP_PERMANENT_TOKEN = 'mock-whatsapp-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock-phone-id';
  process.env.WHATSAPP_OTP_TEMPLATE_NAME = 'codeup';
  process.env.WHATSAPP_OTP_TEMPLATE_LANG = 'en';
  process.env.WHATSAPP_PARAMETER_NAME = 'text';
  process.env.WHATSAPP_TEMPLATE_HAS_BUTTON = 'false';
  delete process.env.WHATSAPP_OFFLINE;

  const calls: Array<{ url: string; options: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), options: init || {} });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { sendOtpWhatsApp } = await importFresh<typeof import('../src/lib/whatsapp.ts')>('../src/lib/whatsapp.ts');
    await sendOtpWhatsApp('01012345678', '987654');

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /graph\.facebook\.com\/v25\.0\/mock-phone-id\/messages$/);

    const body = JSON.parse(String(calls[0].options.body || '{}'));
    assert.equal(body.messaging_product, 'whatsapp');
    assert.equal(body.to, '201012345678');
    assert.equal(body.template.name, 'codeup');
    assert.equal(body.template.language.code, 'en');
    
    // Check parameters and named parameter support
    const components = body.template.components;
    assert.equal(components.length, 1); // Only body, no button
    assert.equal(components[0].type, 'body');
    assert.equal(components[0].parameters[0].type, 'text');
    assert.equal(components[0].parameters[0].text, '987654');
    assert.equal(components[0].parameters[0].parameter_name, 'text'); // Named parameter support
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testWhatsAppFallbackToSms() {
  process.env.WHATSAPP_PERMANENT_TOKEN = 'mock-whatsapp-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock-phone-id';
  process.env.WHATSAPP_OTP_TEMPLATE_NAME = 'codeup';
  process.env.DEV_SKIP_SMS = 'false';
  process.env.TWILIO_ACCOUNT_SID = 'AC123';
  process.env.TWILIO_FROM_NUMBER = '+123';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  delete process.env.TWILIO_USE_VERIFY;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Force a WhatsApp API failure (e.g. invalid template / token error)
    if (String(input).includes('graph.facebook.com')) {
      return new Response(JSON.stringify({ error: { message: 'Template not found' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Success for Twilio
    return new Response(JSON.stringify({ sid: 'SM123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { sendVerificationCode } = await importFresh<typeof import('../src/lib/whatsapp.ts')>('../src/lib/whatsapp.ts');
    const result = await sendVerificationCode('01012345678', '112233');

    // Should fall back to SMS automatically on WhatsApp failure
    assert.equal(result.channel, 'sms');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  await testPhoneNormalization();
  await testDevMockSms();
  await testVerifySmsRequestShape();
  await testWhatsAppPayloadShape();
  await testWhatsAppFallbackToSms();
  console.log('verification tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

