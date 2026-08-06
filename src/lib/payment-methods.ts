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
    description: "فودافون كاش، اتصالات كاش، أورانج كاش، و WE Pay عبر الهاتف المحمول",
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
  /* ─── Sha7nawy Gateway (gate.sha7nawy.com) ─────────────────────────── */
  {
    id: "vf_cash",
    label: "فودافون كاش",
    labelEn: "Vodafone Cash",
    description: "ادفع فوراً من محفظة فودافون كاش عبر طلب دفع مباشر على هاتفك (بوابة Sha7nawy).",
    category: "wallet",
    provider: "sha7nawy",
    brandColor: "#E60000",
    brandForeground: "#FFFFFF",
    monogram: "VF",
    needsPhone: true,
    requiresReference: false,
    available: true,
    processingSpeed: "تأكيد فوري (خلال دقيقة)",
    feePercentage: 2,
    minAmount: 5,
    maxAmount: 10000,
    shortNote: "اطلب *9*1# خلال دقيقة واحدة واكتب الرقم السري لتأكيد عملية الخصم",
    instructions: [
      "سيصلك إشعار بطلب الدفع على رقم محفظتك خلال ثوانٍ.",
      "اطلب *9*1# من هاتفك خلال دقيقة واحدة.",
      "اختر «الموافقة على طلب الدفع» وأدخل الرقم السري للمحفظة.",
      "سيتم شحن رصيدك تلقائياً فور تأكيد الدفع.",
    ],
  },
  {
    id: "et_cash",
    label: "اتصالات كاش (e& Money)",
    labelEn: "Etisalat Cash / e& Money",
    description: "ادفع فوراً من محفظة اتصالات كاش أو تطبيق e& Money (بوابة Sha7nawy).",
    category: "wallet",
    provider: "sha7nawy",
    brandColor: "#76B900",
    brandForeground: "#0B1F00",
    monogram: "e&",
    needsPhone: true,
    requiresReference: false,
    available: true,
    processingSpeed: "تأكيد فوري",
    feePercentage: 2,
    minAmount: 5,
    maxAmount: 10000,
    shortNote: "افتح تطبيق e& Money واقبل طلب الدفع المعلق فوراً",
    instructions: [
      "سيصلك إشعار بطلب الدفع المعلق على محفظتك خلال ثوانٍ.",
      "افتح تطبيق e& Money أو محفظة اتصالات كاش.",
      "اقبل طلب الدفع المعلق وأكد بالرقم السري.",
      "سيتم شحن رصيدك تلقائياً فور تأكيد الدفع.",
    ],
  },

  /* ─── Shake-Out Gateway (dash.shake-out.com) ────────────────────────── */
  {
    id: "or_cash",
    label: "أورانج كاش",
    labelEn: "Orange Cash",
    description: "ادفع فوراً من محفظة أورانج كاش عبر الهاتف المحمول (بوابة Sha7nawy).",
    category: "wallet",
    provider: "sha7nawy",
    brandColor: "#FF7900",
    brandForeground: "#FFFFFF",
    monogram: "OR",
    needsPhone: true,
    requiresReference: false,
    available: false,
    unavailableNote: "غير متاحة حالياً — يرجى استخدام فودافون كاش أو اتصالات كاش أو فوري",
    processingSpeed: "تأكيد فوري",
    feePercentage: 2,
    minAmount: 5,
    maxAmount: 10000,
    shortNote: "طريقة غير متاحة حالياً على البوابة",
    instructions: [],
  },
  {
    id: "fawry",
    label: "فوري (Fawry Pay)",
    labelEn: "Fawry Kiosk Pay",
    description: "احصل على رقم مرجعي وادفع كاش في أي منفذ أو سوبرماركت (بوابة Shake-Out).",
    category: "kiosk",
    provider: "shakeout",
    brandColor: "#FFCC00",
    brandForeground: "#000000",
    monogram: "FWR",
    needsPhone: false,
    requiresReference: true,
    available: true,
    processingSpeed: "خلال 5 دقائق من السداد",
    feePercentage: 2.5,
    minAmount: 10,
    maxAmount: 20000,
    shortNote: "اعرض الرقم المرجعي على التاجر وادفع كاش عبر خدمة فوري باي",
    instructions: [
      "احفظ الرقم المرجعي المكون من 9 أرقام الذي يظهر لك.",
      "توجه إلى أقرب منفذ فوري أو سوبرماركت.",
      "أخبر التاجر برغبتك في الدفع عبر خدمة «فوري باي - Fawry Pay».",
      "ادفع المبلغ المطلوب واستلم إيصال السداد.",
    ],
  },
  {
    id: "bank_card",
    label: "البطاقات البنكية (فيزا / ماستركارد)",
    labelEn: "Visa & Mastercard",
    description: "ادفع بأمان باستخدام أي بطاقة خصم مباشر أو ائتمان محلية أو دولية.",
    category: "card",
    provider: "sha7nawy",
    brandColor: "#1A1F71",
    brandForeground: "#FFFFFF",
    monogram: "VISA",
    needsPhone: false,
    requiresReference: false,
    available: false,
    unavailableNote: "غير متاحة حالياً من مزود الخدمة — يرجى استخدام فودافون كاش، اتصالات كاش، أو فوري",
    processingSpeed: "تأكيد فوري 3D Secure",
    feePercentage: 2.5,
    minAmount: 20,
    maxAmount: 50000,
    shortNote: "طريقة غير متاحة حالياً على البوابة",
    instructions: [],
  },
  {
    id: "meeza",
    label: "بطاقة ميزة الوطنية (Meeza)",
    labelEn: "Meeza National Card",
    description: "ادفع بكل سهولة عبر بطاقة ميزة الوطنية الصادرة من أي بنك مصري.",
    category: "card",
    provider: "sha7nawy",
    brandColor: "#007A3D",
    brandForeground: "#FFFFFF",
    monogram: "MEZ",
    needsPhone: false,
    requiresReference: false,
    available: false,
    unavailableNote: "غير متاحة حالياً من مزود الخدمة — يرجى استخدام فودافون كاش، اتصالات كاش، أو فوري",
    processingSpeed: "تأكيد فوري",
    feePercentage: 1.5,
    minAmount: 10,
    maxAmount: 30000,
    shortNote: "طريقة غير متاحة حالياً على البوابة",
    instructions: [],
  },

  /* ─── Disabled / Unverified Gateway Methods ───────────────────────── */
  {
    id: "instapay",
    label: "إنستاباي (InstaPay)",
    labelEn: "InstaPay IPN Direct",
    description: "تحويل لحظي مباشر عبر تطبيق InstaPay مصر.",
    category: "instant",
    provider: "shakeout",
    brandColor: "#0047BA",
    brandForeground: "#FFFFFF",
    monogram: "IPN",
    needsPhone: false,
    requiresReference: true,
    available: false,
    unavailableNote: "غير متاحة حالياً عبر البوابة — يرجى اختيار إحدى الوسائل المفعلة (فوري، البطاقات، أورانج كاش، فودافون، أو اتصالات كاش)",
    processingSpeed: "تأكيد لحظي",
    feePercentage: 0,
    minAmount: 10,
    maxAmount: 50000,
    shortNote: "طريقة غير مفعلة حالياً على البوابة",
    instructions: [],
  },
  {
    id: "we_pay",
    label: "وي باي (WE Pay)",
    labelEn: "WE Pay Wallet",
    description: "ادفع عبر محفظة WE Pay الإلكترونية من المصرية للاتصالات.",
    category: "wallet",
    provider: "shakeout",
    brandColor: "#5B2C86",
    brandForeground: "#FFFFFF",
    monogram: "WE",
    needsPhone: true,
    requiresReference: false,
    available: false,
    unavailableNote: "غير متاحة حالياً عبر البوابة — يرجى استخدام محفظة أورانج كاش أو فودافون كاش أو اتصالات كاش",
    processingSpeed: "تأكيد فوري",
    feePercentage: 2,
    minAmount: 5,
    maxAmount: 10000,
    shortNote: "طريقة غير مفعلة حالياً",
    instructions: [],
  },
  {
    id: "shakeout_wallet",
    label: "بوابة Shake-Out المباشرة (محافظ إلكترونية)",
    labelEn: "Shake-Out Direct Wallet",
    description: "ادفع مباشرة عبر بوابة Shake-Out (dash.shake-out.com).",
    category: "wallet",
    provider: "shakeout",
    brandColor: "#634C96",
    brandForeground: "#FFFFFF",
    monogram: "SO",
    needsPhone: true,
    requiresReference: false,
    available: false,
    unavailableNote: "يرجى اختيار إحدى المحافظ الإلكترونية المحددة (أورانج كاش، اتصالات كاش، أو فودافون كاش)",
    processingSpeed: "تأكيد فوري عبر Shake-Out",
    feePercentage: 2,
    minAmount: 5,
    maxAmount: 10000,
    shortNote: "ادفع فوراً عبر بوابة Shake-Out المشفرة",
    instructions: [],
  },

  /* ─── Platform Balance & Bank Options ─────────────────────────────── */
  {
    id: "wallet_balance",
    label: "رصيد الحساب المنصة",
    labelEn: "Account Balance",
    description: "الدفع المباشر من رصيد محفظتك المتاحة بالمنصة بدون أي رسوم تحويل.",
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
    shortNote: "يتم الخصم المباشر من رصيدك المتوفر فوراً بدون رسوم",
    instructions: [
      "تأكد من وجود رصيد كافٍ في محفظتك الشخصية.",
      "اضغط على تأكيد الخصم المباشر.",
      "يتم اقتطاع سعر الكورس أو الاشتراك فوراً وتفعيل الخدمة.",
    ],
  },
  {
    id: "voucher",
    label: "كود / قسيمة الشحن",
    labelEn: "Prepaid Voucher Code",
    description: "أدخل كود قسيمة الشحن المكون من أرقام لشحن رصيدك فورياً.",
    category: "voucher",
    provider: "internal",
    brandColor: "#8B5CF6",
    brandForeground: "#FFFFFF",
    monogram: "CODE",
    needsPhone: false,
    requiresReference: true,
    available: true,
    processingSpeed: "تأكيد فوري",
    feePercentage: 0,
    minAmount: 1,
    maxAmount: 50000,
    shortNote: "أدخل كود الكارت المكون من 12 إلى 16 رقم لشحن الحساب فوراً",
    instructions: [
      "احصل على كود الشحن المطبوع أو المرسل لك.",
      "أدخل الكود في خانة الشحن واضغط تأكيد.",
      "تتم إضافة قيمة القسيمة كاملة لحسابك مباشرة.",
    ],
  },
  {
    id: "bank_transfer",
    label: "التحويل البنكي المباشر",
    labelEn: "Direct Bank Wire",
    description: "تحويل بنكي مباشر لحساب المنصة لدى البنك الأهلي المصري أو CIB.",
    category: "bank",
    provider: "bank",
    brandColor: "#1E293B",
    brandForeground: "#FFFFFF",
    monogram: "BANK",
    needsPhone: false,
    requiresReference: true,
    available: true,
    processingSpeed: "خلال 1-3 ساعات عمل",
    feePercentage: 0,
    minAmount: 50,
    maxAmount: 100000,
    shortNote: "حول لحسابنا البنكي وقم بإرفاق صورة الإيصال لتأكيد الشحن",
    instructions: [
      "حول المبلغ المطلوب إلى رقم الحساب / IBAN الموضح بالتعليمات.",
      "احفظ إيصال التحويل أو صورة الشاشة.",
      "قم بإرفاق رقم التحويل أو الصورة من صفحة الدفع.",
      "سيتم تأكيد الإيداع وإضافة الرصيد لحسابك خلال ساعات العمل.",
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
