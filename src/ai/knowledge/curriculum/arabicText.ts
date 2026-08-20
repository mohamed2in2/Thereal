/**
 * Arabic text handling for curriculum search.
 *
 * Normalisation here is applied ONLY to build search keys. The stored
 * curriculum text is never modified, so quotes shown to a student keep their
 * original spelling, hamza forms and diacritics.
 */

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const NON_WORD = /[^\p{L}\p{N}\s]/gu;
const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Prefixes safe to strip for matching; only removed when a real stem remains. */
const PREFIXES = ["وال", "بال", "كال", "فال", "ال", "لل"];
const SUFFIXES = ["ات", "ية", "ين", "ون", "ها", "هم", "تها", "ان"];

const STOPWORDS = new Set([
  "في", "من", "على", "الى", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "التي",
  "الذي", "ما", "لا", "ان", "أن", "إن", "كان", "كانت", "هو", "هي", "ثم", "او",
  "أو", "كل", "بين", "عند", "قد", "هل", "كيف", "لماذا", "متى", "اين", "أين",
  "the", "a", "an", "of", "in", "to", "and", "is", "are", "for", "on", "what",
  "how", "why", "when", "which",
]);

export function normaliseArabic(input: string): string {
  if (!input) return "";
  let text = input.normalize("NFKC");
  text = text.replace(ARABIC_INDIC, (d) =>
    String(d.charCodeAt(0) >= 0x06f0 ? d.charCodeAt(0) - 0x06f0 : d.charCodeAt(0) - 0x0660)
  );
  text = text.replace(DIACRITICS, "");
  text = text
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // alef variants -> alef
    .replace(/\u0649/g, "\u064A") // alef maksura -> yeh
    .replace(/\u0629/g, "\u0647") // teh marbuta -> heh
    .replace(/[\u0624]/g, "\u0648")
    .replace(/[\u0626]/g, "\u064A")
    .replace(/\u06CC/g, "\u064A")
    .replace(/\u06A9/g, "\u0643");
  text = text.replace(NON_WORD, " ");
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function stem(token: string): string {
  let out = token;
  for (const prefix of PREFIXES) {
    if (out.startsWith(prefix) && out.length - prefix.length >= 3) {
      out = out.slice(prefix.length);
      break;
    }
  }
  for (const suffix of SUFFIXES) {
    if (out.endsWith(suffix) && out.length - suffix.length >= 3) {
      out = out.slice(0, -suffix.length);
      break;
    }
  }
  return out;
}

export function tokenise(input: string): string[] {
  const normalised = normaliseArabic(input);
  if (!normalised) return [];
  const tokens: string[] = [];
  for (const raw of normalised.split(" ")) {
    if (!raw || raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    const stemmed = stem(raw);
    if (stemmed.length >= 2) tokens.push(stemmed);
  }
  return tokens;
}
