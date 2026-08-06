import { prisma } from "./prisma";

/**
 * Editable site copy. Each key has a hardcoded default (so the site never shows
 * blanks) that the superadmin can override from the panel. Overrides live in the
 * existing AppSetting key/value table under a "site_text:" prefix.
 */

export const SITE_TEXT_DEFAULTS = {
  hero_subtitle:
    "منصة تعليمية متكاملة مصممة خصيصاً للمتعلمين المصريين — مسارات تفاعلية، مشاريع عملية، ومتابعة شخصية مستمرة.",
  contact_heading: "تواصل معنا",
  contact_subtitle: "نحن هنا للإجابة على أسئلتك في أي وقت",
  contact_email: "contact@code-up.tech",
  contact_phone: "01285353604",
  cta_heading: "مستعد لبدء رحلتك الدراسية؟",
  cta_subtitle: "انضم إلى آلاف المتعلمين الذين يحققون نتائج استثنائية مع منصتنا",
} as const;

export type SiteTextKey = keyof typeof SITE_TEXT_DEFAULTS;
export type SiteText = Record<SiteTextKey, string>;

/** Arabic labels shown in the editor panel. */
export const SITE_TEXT_LABELS: Record<SiteTextKey, string> = {
  hero_subtitle: "النص التعريفي تحت العنوان الرئيسي",
  contact_heading: "عنوان قسم التواصل",
  contact_subtitle: "وصف قسم التواصل",
  contact_email: "البريد الإلكتروني",
  contact_phone: "رقم الهاتف",
  cta_heading: "عنوان دعوة التسجيل (أسفل الصفحة)",
  cta_subtitle: "وصف دعوة التسجيل",
};

const PREFIX = "site_text:";

function isKey(k: string): k is SiteTextKey {
  return k in SITE_TEXT_DEFAULTS;
}

/** Merged site text: defaults with any superadmin overrides applied. */
export async function getSiteText(): Promise<SiteText> {
  const out: SiteText = { ...SITE_TEXT_DEFAULTS };
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { startsWith: PREFIX } },
    });
    for (const row of rows) {
      const k = row.key.slice(PREFIX.length);
      if (isKey(k) && row.value) out[k] = row.value;
    }
  } catch {
    /* table missing / db error → return defaults */
  }
  return out;
}

/** Persist a single override (ignored if the key is unknown). */
export async function setSiteText(key: string, value: string): Promise<void> {
  if (!isKey(key)) throw new Error("Unknown site-text key");
  const v = (value ?? "").trim().slice(0, 500);
  await prisma.appSetting.upsert({
    where: { key: PREFIX + key },
    update: { value: v },
    create: { key: PREFIX + key, value: v },
  });
}
