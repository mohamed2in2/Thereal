"""Curriculum structure detection: term -> chapter -> lesson -> section.

Two independent signals are combined:

* the table of contents, which gives the canonical chapter and lesson titles;
* the running head printed on every content page ("1-1 — <lesson title>"),
  which says exactly which lesson each page belongs to.

The running head is authoritative for page ownership; the table of contents is
authoritative for titles.
"""

import re

from clean import normalise_text
from markers import NUMBERED_SECTION, classify_marker, strip_icons

LESSON_HEAD = re.compile(r"^(\d+)\s*-\s*(\d+)\s*[\u2014\u2013-]\s*(\S.*)$")
LESSON_TOC = re.compile(r"^(\d+)\s*-\s*(\d+)$")
LESSON_TITLE_PAGE = re.compile(r"^الدرس\s+(\d+)\s*-\s*(\d+)\s*$")



TERM_BY_PART = {1: 1, 2: 2}


def _strip_icons(text):
    return re.sub(r"^[^\w\u0600-\u06ff(]+", "", text).strip()


def classify_marker(text):
    """Return a content type if this block is a known section marker heading."""
    head = _strip_icons(normalise_text(text))
    if len(head) > 60:
        return None
    for marker, kind in CONTENT_MARKERS:
        if head.startswith(marker):
            return kind
    return None


def parse_toc(pages):
    """Extract chapters and lessons from the contents page."""
    toc_page = None
    for page in pages:
        texts = [normalise_text(l["text"]) for l in page["lines"]]
        if any(t == "المحتويات" for t in texts):
            toc_page = page
            break
    if toc_page is None:
        return []

    entries = []
    lines = sorted(toc_page["lines"], key=lambda l: (round(l["y"] / 2.5), -l["x1"]))
    chapters = {}
    pending_lesson = None

    for line in lines:
        text = normalise_text(line["text"])
        if not text:
            continue
        # Chapter number is set in a noticeably larger face than lesson numbers.
        if re.fullmatch(r"\d+", text) and line["size"] >= 15:
            chapters["current"] = int(text)
            chapters["awaiting_title"] = True
            continue
        if chapters.get("awaiting_title") and not re.fullmatch(r"[\d\s/]+", text):
            entries.append(
                {
                    "kind": "chapter",
                    "chapter_number": chapters["current"],
                    "title": text,
                }
            )
            chapters["awaiting_title"] = False
            continue
        m = LESSON_TOC.match(text)
        if m:
            pending_lesson = (int(m.group(1)), int(m.group(2)))
            continue
        if pending_lesson and not re.fullmatch(r"[\d\s/]+", text):
            entries.append(
                {
                    "kind": "lesson",
                    "chapter_number": pending_lesson[0],
                    "lesson_index": pending_lesson[1],
                    "lesson_number": f"{pending_lesson[0]}-{pending_lesson[1]}",
                    "title": text,
                }
            )
            pending_lesson = None
    return entries


def lesson_for_page(page):
    """Read the lesson number/title off the page's running head, if present."""
    for text in page.get("chrome", []):
        m = LESSON_HEAD.match(normalise_text(text))
        if m:
            return f"{m.group(1)}-{m.group(2)}", m.group(3).strip()
    for block in page.get("blocks", []):
        m = LESSON_TITLE_PAGE.match(normalise_text(block["text"]))
        if m:
            return f"{m.group(1)}-{m.group(2)}", None
    return None, None


def assign_pages(cleaned_pages):
    """Attach a lesson number to every page, carrying forward across spreads."""
    current = None
    header_titles = {}
    for page in cleaned_pages:
        lesson, title = lesson_for_page(page)
        if lesson:
            current = lesson
            if title:
                header_titles.setdefault(lesson, title)
        page["lesson_number"] = current
        page["chapter_number"] = int(current.split("-")[0]) if current else None
    return header_titles
