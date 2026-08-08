/**
 * Centralized Payment Methods Configuration
 *
 * Single source of truth for every payment method supported by the platform
 * across its dual payment providers: Sha7nawy (gate.sha7nawy.com) and Shake-Out (dash.shake-out.com).
 *
 * Both payment gateways work together side-by-side.
 */

export type PaymentMethodCategory =
  | "wallet"
  | "instant"
  | "kiosk"
  | "card"
  | "balance"
  | "voucher"
  | "bank";

export type PaymentProvider = "sha7nawy" | "shakeout" | "internal" | "bank";

export interface PaymentCategoryMetadata {
  id: PaymentMethodCategory;
  label: string;
  labelEn: string;
  description: string;
}

export const PAYMENT_CATEGORIES: readonly PaymentCategoryMetadata[] = [
  {
    id: "wallet",
    label: "المحافظ الإلكترونية",
    labelEn: "Mobile Wallets",
    description: "فودافون كاش، اتصالات كاش، وأورانج كاش عبر الهاتف المحمول",
  },
  {
    id: "instant",
    label: "شبكة المدفوعات اللحظية (إنستاباي)",
    labelEn: "Instant Payment Network (InstaPay)",
    description: "تحويل فوري ومباشر بدون رسوم عبر تطبيق InstaPay مصر",
  },
  {
    id: "kiosk",
    label: "فوري ومنافذ التحصيل",
    labelEn: "Fawry & Retail Kiosks",
    description: "ادفع كاش برقم مرجعي في أي منفذ فوري أو سوبرماركت",
  },
  {
    id: "card",
    label: "البطاقات البنكية",
    labelEn: "Debit & Credit Cards",
    description: "فيزا، ماستركارد، وبطاقات ميزة الوطنية",
  },
  {
    id: "balance",
    label: "رصيد الحساب",
    labelEn: "Platform Balance",
    description: "الشراء الفوري والمباشر باستخدام رصيدك المشحون في الموقع",
  },
  {
    id: "voucher",
    label: "أكواد وقسائم الشحن",
    labelEn: "Vouchers & Gift Codes",
    description: "شحن رصيد فورياً باستخدام كود قسيمة الشحن",
  },
  {
    id: "bank",
    label: "التحويل البنكي المباشر",
    labelEn: "Direct Bank Transfer",
    description: "تحويل مباشر لحساباتنا البنكية في البنك الأهلي / التجاري الدولي",
  },
];

export interface PaymentMethodConfig {
  /** Gateway method identifier sent to the provider API or internal router. */
  id: string;
  /** Arabic display name (UI is RTL Arabic-first). */
  label: string;
  /** Latin display name for secondary caption. */
  labelEn: string;
  /** One-line description shown on the method card. */
  description: string;
  /** Grouping used for layout & category filtering. */
  category: PaymentMethodCategory;
  /** Active payment gateway provider handling this method. */
  provider: PaymentProvider;
  /** Brand color used for icon background & accents. */
  brandColor: string;
  /** Foreground color readable on brandColor. */
  brandForeground: string;
  /** Two/Three letter monogram rendered when no SVG image is available. */
  monogram: string;
  /** True when this method requires the payer's wallet phone number. */
  needsPhone: boolean;
  /** True when this method requires entering an activation/voucher code. */
  needsCode?: boolean;
  /** True when paying requires acting on a reference/PIN (shown on instructions step). */
  requiresReference: boolean;
  /** False = shown greyed-out with unavailableNote, and rejected server-side. */
  available: boolean;
  /** Why the method is unavailable (shown on card + validation errors). */
  unavailableNote?: string;
  /** Human-readable confirmation speed for the user. */
  processingSpeed: string;
  /** Gateway fee percentage added (e.g. 2%). */
  feePercentage: number;
  /** Minimum amount permitted in EGP. */
  minAmount: number;
  /** Maximum amount permitted in EGP. */
  maxAmount: number;
  /** Compact one-line note used as API messages / legacy instruction text. */
  shortNote: string;
  /** Step-by-step Arabic instructions rendered on the instructions step or modal. */
  instructions: string[];
}

export const PAYMENT_METHODS: readonly PaymentMethodConfig[] = [
  {
    id: "vf_cash",
    label: "فودافون كاش",
    labelEn: "Vodafone Cash",
    description: "ادفع فوراً وبأمان من محفظة فودافون كاش عبر هاتفك المحمول.",
    category: "wallet",
    provider: "sha7nawy",
    brandColor: "#E60000",
    brandForeground: "#FFFFFF",
    monogram: "VF",
    needsPhone: true,
    requiresReference: false,
    available: true,
    processingSpeed: "تأكيد فوري (*9*1#)",
    feePercentage: 2,
    minAmount: 1,
    maxAmount: 10000,
    shortNote: "اطلب *9*1# واقبل طلب الخصم برقمك السري خلال دقيقة",
    instructions: [
      "سيصلك إشعار بطلب الدفع على رقم محفظتك خلال ثوانٍ.",
      "اطلب *9*1# من هاتفك خلال دقيقة واحدة.",
      "اختر «الموافقة على طلب الدفع» وأدخل الرقم السري للمحفظة.",
      "سيتم تفعيل اشتراكك وشحن رصيدك تلقائياً فور التأكيد.",
    ],
  },
  {
    id: "fawry",
    label: "فوري (Fawry Pay)",
    labelEn: "Fawry Pay Reference",
    description: "احصل على كود مرجعي وسدد كاش في أي كشك، سوبرماركت، أو منفذ فوري.",
    category: "kiosk",
    provider: "shakeout",
    brandColor: "#FFC20E",
    brandForeground: "#000000",
    monogram: "FAW",
    needsPhone: true,
    requiresReference: true,
    available: true,
    processingSpeed: "فوري خلال دقائق",
    feePercentage: 1,
    minAmount: 1,
    maxAmount: 20000,
    shortNote: "احتفظ بالرقم المرجعي وسدد كاش في أي كشك أو فرع فوري",
    instructions: [
      "سيظهر لك رقم مرجعي (Fawry Reference Code) فور تأكيد الطلب.",
      "توجه لأقرب كشك، سوبرماركت، أو منفذ فوري.",
      "اطلب من التاجر الدفع عبر «خدمة فوري مدفوعات إلكترونية / كود مرجعي».",
      "أعطه الرقم المرجعي وسدد المبلغ المطلوب كاش.",
      "سيتم تأكيد العملية وتفعيل حسابك تلقائياً.",
    ],
  },
  {
    id: "voucher",
    label: "كود / قسيمة تفعيل",
    labelEn: "Prepaid Code / Voucher",
    description: "تفعيل مباشر باستخدام كود التفعيل المطبوع أو كود القسيمة الرقمي.",
    category: "voucher",
    provider: "internal",
    brandColor: "#8B5CF6",
    brandForeground: "#FFFFFF",
    monogram: "CODE",
    needsPhone: false,
    needsCode: true,
    requiresReference: true,
    available: true,
    processingSpeed: "تأكيد فوري",
    feePercentage: 0,
    minAmount: 1,
    maxAmount: 50000,
    shortNote: "أدخل كود التفعيل المكون من أرقام أو حروف واضغط تأكيد",
    instructions: [
      "احصل على كود التفعيل المطبوع أو المرسل لك من السنتر / المعلم.",
      "أدخل الكود واضغط تفعيل.",
      "تتم إضافة القيمة وتفعيل الكورس لحسابك مباشرة.",
    ],
  },
  {
    id: "wallet_balance",
    label: "رصيد الحساب بالمنصة",
    labelEn: "Account Balance",
    description: "الدفع المباشر واللحظي من رصيدك المتاح في المنصة بدون رسوم.",
    category: "balance",
    provider: "internal",
    brandColor: "#10B981",
    brandForeground: "#FFFFFF",
    monogram: "BAL",
    needsPhone: false,
    requiresReference: false,
    available: true,
    processingSpeed: "فوري 0 ثانية",
    feePercentage: 0,
    minAmount: 1,
    maxAmount: 100000,
    shortNote: "خصم مباشر من رصيدك المتوفر فوراً بدون رسوم إضافية",
    instructions: [
      "تأكد من وجود رصيد كافٍ في حسابك.",
      "اضغط على تأكيد الخصم المباشر.",
      "يتم تفعيل طلبك وتحديث الرصيد فوراً.",
    ],
  },
];

/** Resolve a gateway method id to its config, or null when unknown. */
export function getPaymentMethod(id: string): PaymentMethodConfig | null {
  return PAYMENT_METHODS.find((m) => m.id === id) ?? null;
}

/** All methods for the UI; unavailable ones are included but greyed out. */
export function listPaymentMethods(): readonly PaymentMethodConfig[] {
  return PAYMENT_METHODS;
}

/** Only methods the user can actually pay with right now. */
export function listAvailablePaymentMethods(): PaymentMethodConfig[] {
  return PAYMENT_METHODS.filter((m) => m.available);
}

/** List payment methods belonging to a specific category. */
export function listPaymentMethodsByCategory(
  category: PaymentMethodCategory
): PaymentMethodConfig[] {
  return PAYMENT_METHODS.filter((m) => m.category === category);
}

/** Filter methods by category and/or live search query (Arabic or English). */
export function filterPaymentMethods(
  category?: PaymentMethodCategory | "all",
  searchQuery?: string
): PaymentMethodConfig[] {
  let list = [...PAYMENT_METHODS];

  if (category && category !== "all") {
    list = list.filter((m) => m.category === category);
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.labelEn.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }

  return list;
}
