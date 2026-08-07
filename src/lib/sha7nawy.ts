/**
 * Sha7nawy Payment Gateway SDK Service (https://gate.sha7nawy.com)
 * Handles payment transactions for Sha7nawy-routed mobile wallet providers:
 * - Vodafone Cash (vf_cash) -> *9*1# prompt
 * - Etisalat Cash (et_cash) -> e& Money App prompt
 * - Orange Cash (or_cash)   -> Orange Cash app prompt
 * (Fawry is the only method routed via Shake-Out at dash.shake-out.com)
 */

import { getPaymentMethod, PAYMENT_METHODS } from "./payment-methods";

export type Sha7nawyWalletMethod =
  | "vf_cash"
  | "or_cash"
  | "et_cash"
  | "we_pay"
  | "instapay"
  | "fawry"
  | "bank_card"
  | "meeza"
  | "wallet_balance"
  | "voucher"
  | "bank_transfer"
  | (string & {});

export interface CreatePaymentParams {
  number: string;
  amount: number;
  method: Sha7nawyWalletMethod;
  client?: string;
  details?: string;
  webhook_url?: string;
}

export interface Sha7nawyPaymentData {
  id: number;
  amount: string;
  number: string;
  method: Sha7nawyWalletMethod;
  reference: string;
  status: string;
  client?: string;
  details?: string;
  transaction_id?: string;
  provider_transaction_id?: string;
  transaction_Time?: string;
  last_updated?: string;
  created_at?: string;
  updated_at?: string;
  payment_page_url?: string;
  url?: string;
}

export interface Sha7nawyCreateResponse {
  status: boolean;
  code: number;
  message: string;
  data?: Sha7nawyPaymentData;
  error?: string;
}

/**
 * Dynamic lookup helper that resolves labels from central PAYMENT_METHODS.
 */
export const WALLET_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.id, m.label])
);

/**
 * Dynamic lookup helper that resolves instructions from central PAYMENT_METHODS.
 */
export const WALLET_INSTRUCTIONS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.id, m.shortNote])
);

// Ledger types + note format used to bind Sha7nawy webhooks to the pending
// payment that was recorded when a logged-in user initiated the payment.
export const SHA7NAWY_PENDING_TYPE = "credit_sha7nawy_pending";
export const SHA7NAWY_CREDITED_TYPE = "credit_sha7nawy_wallet";

export const SHA7NAWY_PAID_STATUSES = ["completed", "paid", "settled", "success"];

export function sha7nawyRefNote(reference: string): string {
  return `sha7nawy_ref:${reference}`;
}

/**
 * Calculates tax/fee on base payment amount based on the selected method config
 */
export function calculateAmountWithTax(
  baseAmount: number,
  methodId: string = "vf_cash"
): { baseAmount: number; taxAmount: number; totalAmount: number; feePercentage: number } {
  const method = getPaymentMethod(methodId);
  const feePct = method?.feePercentage ?? 2;
  const taxAmount = Math.round(baseAmount * (feePct / 100) * 100) / 100;
  const totalAmount = Math.round((baseAmount + taxAmount) * 100) / 100;
  return { baseAmount, taxAmount, totalAmount, feePercentage: feePct };
}

/**
 * Validates an Egyptian mobile wallet phone number (11 digits starting with 01)
 */
export function validateEgyptianPhone(phone: string): boolean {
  const clean = phone.trim().replace(/\D/g, "");
  return /^01[0125]\d{8}$/.test(clean);
}

/**
 * Normalizes phone number to 11 digits format (e.g. 01234567890)
 */
export function normalizeEgyptianPhone(phone: string): string {
  let clean = phone.trim().replace(/\D/g, "");
  if (clean.startsWith("20")) {
    clean = clean.slice(2);
  }
  if (clean.startsWith("+20")) {
    clean = clean.slice(3);
  }
  return clean;
}

/**
 * Creates a mobile wallet or gateway payment request via Payment Gateway API
 */
export async function createSha7nawyPayment(
  params: CreatePaymentParams
): Promise<Sha7nawyCreateResponse> {
  const baseUrl = (process.env.SHA7NAWY_BASE_URL || "https://gate.sha7nawy.com").replace(/\/$/, "");
  const publicKey = process.env.SHA7NAWY_PUBLIC_KEY;

  if (!publicKey) {
    console.warn("[Sha7nawy API] SHA7NAWY_PUBLIC_KEY is not configured in environment");
    return {
      status: false,
      code: 400,
      message: "بوابة Sha7nawy (gate.sha7nawy.com) قيد التفعيل. يرجى استخدام فوري في الوقت الحالي.",
    };
  }

  const methodConfig = getPaymentMethod(params.method);
  if (methodConfig && !methodConfig.available) {
    return {
      status: false,
      code: 400,
      message: methodConfig.unavailableNote || `طريقة الدفع (${methodConfig.label}) غير متاحة حالياً.`,
    };
  }

  // Validate phone number if method requires it
  let cleanPhone = params.number ? normalizeEgyptianPhone(params.number) : "01000000000";
  if (methodConfig?.needsPhone) {
    if (!validateEgyptianPhone(cleanPhone)) {
      return {
        status: false,
        code: 400,
        message: "رقم المحفظة غير صحيح — يجب أن يكون رقم مصري مكون من 11 رقماً يبدأ بـ 01",
      };
    }
  }

  const minAmt = methodConfig?.minAmount ?? 5;
  const maxAmt = methodConfig?.maxAmount ?? 50000;
  if (!params.amount || params.amount < minAmt || params.amount > maxAmt) {
    return {
      status: false,
      code: 400,
      message: `المبلغ غير مسموح به — الحد الأدنى ${minAmt} جنيه والحد الأقصى ${maxAmt.toLocaleString()} جنيه`,
    };
  }

  const endpoint = `${baseUrl}/api/payment/create`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": publicKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        amount: params.amount,
        method: params.method,
        client: params.client || "codeup-user",
        details: params.details || "Code-UP Balance Top-up",
        webhook_url: params.webhook_url,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        status: false,
        code: res.status,
        message: data.message || data.error || `تعذر بدء عملية الدفع (${res.status})`,
      };
    }

    const shortNote = methodConfig?.shortNote || WALLET_INSTRUCTIONS[params.method] || "تم بدء العملية بنجاح";

    return {
      status: data.status ?? true,
      code: data.code ?? 200,
      message: data.message || shortNote,
      data: data.data,
    };
  } catch (error: any) {
    console.error("[Gateway API] Error calling create payment:", error);
    return {
      status: false,
      code: 500,
      message: "تعذر الاتصال ببوابة الدفع الإلكتروني — حاول مرة أخرى لاحقاً",
    };
  }
}

/**
 * Confirms a payment transaction using ref_code
 */
export async function confirmSha7nawyPayment(ref_code: string): Promise<Sha7nawyCreateResponse> {
  const baseUrl = (process.env.SHA7NAWY_BASE_URL || "https://gate.sha7nawy.com").replace(/\/$/, "");
  const publicKey = process.env.SHA7NAWY_PUBLIC_KEY;

  if (!publicKey) {
    return { status: false, code: 400, message: "مفتاح الربط مع Sha7nawy غير مهيأ" };
  }

  try {
    const res = await fetch(`${baseUrl}/api/payment/confirm`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": publicKey,
      },
      body: JSON.stringify({ ref_code }),
    });

    const data = await res.json().catch(() => ({}));
    return {
      status: data.status ?? res.ok,
      code: data.code ?? res.status,
      message: data.message || (res.ok ? "تم التأكيد بنجاح" : "تعذر التأكيد"),
      data: data.data,
    };
  } catch (error: any) {
    console.error("[Gateway API] Error calling confirm payment:", error);
    return { status: false, code: 500, message: "تعذر الاتصال بسيرفر التأكيد" };
  }
}

/**
 * Server-to-server payment verification (Secret Key Auth)
 */
export async function getSha7nawyPaymentInfo(transaction_id: string | number): Promise<Sha7nawyCreateResponse> {
  const baseUrl = (process.env.SHA7NAWY_BASE_URL || "https://gate.sha7nawy.com").replace(/\/$/, "");
  const secretKey = process.env.SHA7NAWY_SECRET_KEY;

  if (!secretKey) {
    return { status: false, code: 400, message: "مفتاح الاستعلام مع Sha7nawy غير مهيأ" };
  }

  try {
    const res = await fetch(`${baseUrl}/api/payment/info/${transaction_id}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": secretKey,
      },
    });

    const data = await res.json().catch(() => ({}));
    return {
      status: data.status ?? res.ok,
      code: data.code ?? res.status,
      message: data.message || "تم استعلام البيانات بنجاح",
      data: data.data,
    };
  } catch (error: any) {
    console.error("[Gateway API] Error querying payment info:", error);
    return { status: false, code: 500, message: "تعذر الاستعلام من سيرفر التأكيد" };
  }
}
