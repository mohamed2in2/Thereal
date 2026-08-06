/**
 * SEO-friendly English course slugs. Course titles are Arabic, so a transliterated
 * title would be ugly; instead we build a clean, professional English slug from the
 * subject + educational stage + a short unique id suffix, e.g.:
 *   "math-secondary-3-ab12cd"
 * The id suffix guarantees uniqueness. Falls back gracefully for unknown subjects.
 */

const SUBJECT_EN: Record<string, string> = {
  "رياضيات": "math",
  "فيزياء": "physics",
  "كيمياء": "chemistry",
  "أحياء": "biology",
  "لغة عربية": "arabic",
  "لغة إنجليزية": "english",
  "تاريخ": "history",
  "جغرافيا": "geography",
  "علوم": "science",
  "حاسب آلي": "computer-science",
  "برمجة": "programming",
};

function stageEn(stage: string): string {
  const m = (stage || "").match(/^(primary|prep|sec)_(\d)$/);
  if (!m) return "general";
  const prefix = m[1] === "sec" ? "secondary" : m[1];
  return `${prefix}-${m[2]}`;
}

/** Reduce an arbitrary string to a safe ascii slug fragment (empty if none). */
function asciiSlugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function buildCourseSlug(course: {
  id: string;
  subject: string;
  educationalStage: string;
}): string {
  const subj = SUBJECT_EN[(course.subject || "").trim()] || asciiSlugify(course.subject) || "course";
  const stage = stageEn(course.educationalStage);
  const suffix = course.id.slice(-6).toLowerCase();
  return [subj, stage, suffix].filter(Boolean).join("-").replace(/-+/g, "-");
}
