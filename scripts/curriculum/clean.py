"""Cleaning and paragraph reconstruction for extracted curriculum lines.

Everything here is lossless with respect to *meaning*: we normalise encoding,
drop running headers/footers, and rejoin lines that the PDF broke mid-sentence.
Nothing rewrites, summarises or paraphrases the official text.
"""

import re
import unicodedata
from collections import Counter

from markers import classify_marker

TATWEEL = "\u0640"

# Encoding variants that carry no semantic difference in Egyptian schoolbook Arabic.
CHAR_FOLD = {
    "\u06cc": "\u064a",  # Farsi yeh  -> Arabic yeh
    "\u064a\u0654": "\u0626",
    "\u06a9": "\u0643",  # Farsi keheh -> Arabic kaf
    "\u06be": "\u0647",
    "\u200f": "",  # RLM
    "\u200e": "",  # LRM
    "\u200b": "",  # zero width space
    "\u00a0": " ",
}

# Decorative glyphs the layout uses as bullets / icons.
ICON_CHARS = "\u2b50\U0001f4a1\U0001f4cc\U0001f4dd\U0001f30d\u2699\u270e\u21bb\u2713\u2753\u2705"


def normalise_text(text: str) -> str:
    """Normalise encoding without altering wording."""
    text = unicodedata.normalize("NFKC", text)
    for src, dst in CHAR_FOLD.items():
        text = text.replace(src, dst)
    text = text.replace(TATWEEL, "")
    # A combining mark can never legitimately follow a space: the space is an
    # artefact of the glyph-level reconstruction, not part of the word.
    text = re.sub(r"\s+([\u064b-\u0652\u0670])", r"\1", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# Page furniture, matched only inside the top/bottom margin bands.  Section
# markers such as "مصطلحات أساسية" also sit near the top of some pages, so
# frequency alone is not a safe signal - the text must look like chrome too.
CHROME_PATTERNS = [
    re.compile(r"^\d{1,3}$"),
    re.compile(r"^\d+\s*/\s*\d+$"),
    re.compile(r"^\d+\s*-\s*\d+\s*[—–-]\s*\S.*$"),
    re.compile(r"^الفصل\s+\d+"),
]

TOP_BAND = 0.075
BOTTOM_BAND = 0.90


def _in_band(line, height):
    rel = line["y"] / (height or 1.0)
    return rel <= TOP_BAND or rel >= BOTTOM_BAND


def find_running_lines(pages):
    """Identify the repeated book title / running head shown in the margins."""
    counts = Counter()
    for page in pages:
        seen = set()
        for line in page["lines"]:
            if not _in_band(line, page["height"]):
                continue
            key = normalise_text(line["text"])
            if key and key not in seen:
                seen.add(key)
                counts[key] += 1
    threshold = max(6, int(len(pages) * 0.35))
    return {text for text, n in counts.items() if n >= threshold}


LEGIBLE = re.compile(r"[؀-ۿA-Za-z0-9]")


def is_garbage(text: str) -> bool:
    """True for lines produced by the broken Type3 decorative fonts.

    Those fonts have no usable Encoding, so MuPDF emits replacement characters
    and stray private-use glyphs rather than letters.
    """
    stripped = [c for c in text if not c.isspace()]
    if not stripped:
        return True
    legible = sum(1 for c in stripped if LEGIBLE.match(c))
    return legible / len(stripped) < 0.55


def is_page_number(text: str) -> bool:
    return bool(re.fullmatch(r"[\d\s/\u0660-\u0669]{1,9}", text.strip()))


def strip_chrome(page, running):
    """Drop running headers/footers and standalone page numbers from one page."""
    height = page["height"] or 1.0
    kept, chrome = [], []
    for line in page["lines"]:
        text = normalise_text(line["text"])
        if not text:
            continue
        if _in_band(line, height) and (
            text in running
            or is_page_number(text)
            or any(p.match(text) for p in CHROME_PATTERNS)
        ):
            chrome.append(text)
            continue
        if is_garbage(text):
            continue
        kept.append({**line, "text": text})
    return kept, chrome


def _overlap(a, b):
    lo = max(a["x0"], b["x0"])
    hi = min(a["x1"], b["x1"])
    if hi <= lo:
        return 0.0
    return (hi - lo) / max(1.0, min(a["x1"] - a["x0"], b["x1"] - b["x0"]))


SENTENCE_END = tuple(".؟!:؛")


def group_blocks(lines):
    """Rejoin consecutive lines that form one paragraph / column of text."""
    ordered = sorted(lines, key=lambda l: (l["y"], -l["x1"]))
    blocks = []
    for line in ordered:
        # Side panels and table cells interleave with the body column in pure y
        # order, so a paragraph must be able to continue across them: match the
        # line against every still-open block, not just the most recent one.
        # A marker heading ("⭐ الخلاصة", "✎ مثال محلول", ...) opens a new unit;
        # absorbing it into the paragraph above would erase the content type.
        if classify_marker(line["text"]):
            blocks.append({"lines": [line], "sealed": True})
            continue
        best, best_overlap = None, 0.0
        for block in blocks:
            if block.get("sealed"):
                continue
            last = block["lines"][-1]
            gap = line["y"] - last["y"]
            if not (0 <= gap <= max(9.0, last["size"] * 2.1)):
                continue
            if abs(line["size"] - last["size"]) > 0.7:
                continue
            ov = _overlap(line, last)
            if ov >= 0.55 and ov > best_overlap:
                best, best_overlap = block, ov
        if best is not None:
            best["lines"].append(line)
        else:
            blocks.append({"lines": [line]})

    result = []
    for block in blocks:
        parts = [l["text"] for l in block["lines"]]
        text = " ".join(parts)
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue
        first = block["lines"][0]
        result.append(
            {
                "text": text,
                "y": first["y"],
                "x0": min(l["x0"] for l in block["lines"]),
                "x1": max(l["x1"] for l in block["lines"]),
                "size": max(l["size"] for l in block["lines"]),
                "font": first["font"],
                "n_lines": len(block["lines"]),
            }
        )
    return _order_by_column(result)


COLUMN_GAP = 20.0


def _order_by_column(blocks):
    """Order blocks column by column instead of by raw vertical position.

    Lesson pages print a narrow margin panel beside the body column.  In pure y
    order the two interleave, which tears a banner ("⭐ الخلاصة") away from the
    text it introduces.  Projecting every block onto the x axis reveals the
    blank gutter between columns, so each column can be emitted whole.
    """
    if not blocks:
        return blocks

    spans = sorted((b["x0"], b["x1"]) for b in blocks)
    gutters = []
    reach = spans[0][1]
    for x0, x1 in spans[1:]:
        if x0 - reach > COLUMN_GAP:
            gutters.append((reach + x0) / 2.0)
        reach = max(reach, x1)

    def column_of(block):
        centre = (block["x0"] + block["x1"]) / 2.0
        return sum(1 for g in gutters if centre > g)

    # Arabic reads right to left, so the rightmost column comes first.
    return sorted(
        blocks,
        key=lambda b: (-column_of(b), b["y"], -b["x1"]),
    )


def clean_document(pages):
    """Full clean: strip chrome, normalise, rebuild paragraph blocks per page."""
    running = find_running_lines(pages)
    cleaned = []
    for page in pages:
        kept, chrome = strip_chrome(page, running)
        cleaned.append(
            {
                "page_number": page["page_number"],
                "height": page["height"],
                "width": page["width"],
                "blocks": [b for b in group_blocks(kept) if not is_garbage(b["text"])],
                # Kept because the running head names the lesson each page belongs
                # to - the most reliable structure signal in the book.
                "chrome": chrome,
            }
        )
    return cleaned, running
