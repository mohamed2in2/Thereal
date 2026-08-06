import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { normalizeEgyptPhone } from "@/lib/phone";

/**
 * GET /api/admin/test-whatsapp
 * Returns current WhatsApp env config (no secrets) so you can spot mismatches.
 *
 * POST /api/admin/test-whatsapp
 * Body: { phone: "+201XXXXXXXXX", actionPassword: "..." }
 * Sends a real WhatsApp OTP to the given phone and returns the raw Meta API response.
 * Requires superadmin session.
 */

async function requireSuperadmin() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") return null;
  return session;
}

export async function GET() {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  return NextResponse.json({
    config: {
      WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || "(not set)",
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || "(not set)",
      WHATSAPP_PERMANENT_TOKEN: process.env.WHATSAPP_PERMANENT_TOKEN
        ? `${process.env.WHATSAPP_PERMANENT_TOKEN.slice(0, 10)}...${process.env.WHATSAPP_PERMANENT_TOKEN.slice(-6)}`
        : "(not set)",
      WHATSAPP_OTP_TEMPLATE_NAME: process.env.WHATSAPP_OTP_TEMPLATE_NAME || "(not set)",
      WHATSAPP_OTP_TEMPLATE_LANG: process.env.WHATSAPP_OTP_TEMPLATE_LANG || "(not set — defaults to ar_EG)",
      WHATSAPP_PARAMETER_NAME: process.env.WHATSAPP_PARAMETER_NAME || "(not set — no parameter_name will be sent)",
      WHATSAPP_TEMPLATE_HAS_BUTTON: process.env.WHATSAPP_TEMPLATE_HAS_BUTTON || "(not set — defaults to true)",
      WHATSAPP_OFFLINE: process.env.WHATSAPP_OFFLINE || "(not set — defaults to false)",
      TWILIO_BYPASS_VERIFICATION: process.env.TWILIO_BYPASS_VERIFICATION || "(not set)",
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await requireSuperadmin();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { phone?: string; code?: string };
  const phoneRaw = body.phone;

  if (!phoneRaw) {
    return NextResponse.json({ error: "phone is required in request body" }, { status: 400 });
  }

  const token = process.env.WHATSAPP_PERMANENT_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "ar_EG";
  const templateHasButton = process.env.WHATSAPP_TEMPLATE_HAS_BUTTON !== "false";
  const paramName = process.env.WHATSAPP_PARAMETER_NAME || "";
  const testCode = body.code || "123456";

  if (!token || !phoneId || !templateName) {
    return NextResponse.json({
      error: "Missing env vars",
      missing: {
        WHATSAPP_PERMANENT_TOKEN: !token,
        WHATSAPP_PHONE_NUMBER_ID: !phoneId,
        WHATSAPP_OTP_TEMPLATE_NAME: !templateName,
      },
    }, { status: 500 });
  }

  let recipient: string;
  try {
    recipient = normalizeEgyptPhone(phoneRaw).replace("+", "");
  } catch (err: any) {
    return NextResponse.json({ error: `Phone normalization failed: ${err.message}` }, { status: 400 });
  }

  const bodyParam: Record<string, string> = { type: "text", text: testCode };
  if (paramName) bodyParam.parameter_name = paramName;

  const bodyComponents: object[] = [
    {
      type: "body",
      parameters: [bodyParam],
    },
  ];

  if (templateHasButton) {
    const btnParam: Record<string, string> = { type: "text", text: testCode };
    if (paramName) btnParam.parameter_name = paramName;
    bodyComponents.push({
      type: "button",
      index: "0",
      sub_type: "url",
      parameters: [btnParam],
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: templateName === "3p_direct_integration_test_template" ? undefined : bodyComponents,
    },
  };

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    return NextResponse.json({
      success: res.ok,
      httpStatus: res.status,
      metaResponse: data,
      requestPayload: {
        ...payload,
        template: {
          ...payload.template,
          // Don't leak full token in response
        },
      },
      configUsed: {
        phoneId,
        version,
        templateName,
        templateLang,
        templateHasButton,
        recipient,
        testCode,
        tokenPrefix: token.slice(0, 10) + "...",
      },
    }, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      type: "network_error",
    }, { status: 500 });
  }
}
