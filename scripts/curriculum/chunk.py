"""Semantic chunking of the curriculum into retrieval units.

Boundaries follow the book's own structure - numbered sections and the marker
headings that open every activity, solved example, exercise set and summary.
A paragraph is never split, and self-contained units (a worked example, an exam
question with its solution) are allowed to overflow the target size rather than
be cut in half.
"""

import hashlib
import re

from clean import normalise_text
from markers import NUMBERED_SECTION, classify_marker

TARGET_CHARS = 900
MAX_CHARS = 1700
# Units that lose their meaning when split, so they may exceed TARGET_CHARS.
ATOMIC_TYPES = {
    "solved_example",
    "exam_style_question",
    "exercises",
    "practice",
    "activity",
    "solution",
    "challenge",
    "engineering_task",
    "application",
    "key_question",
    "key_question_answer",
    "reflection",
    "lesson_map",
    "learning_objectives",
    "terminology",
    "summary",
}
MIN_CHARS = 90
SECTION_MIN_SIZE = 11.5


def _is_section_heading(block):
    if block["size"] < SECTION_MIN_SIZE:
        return None
    m = NUMBERED_SECTION.match(normalise_text(block["text"]))
    if m and len(m.group(2)) <= 90:
        return f"{m.group(1)}. {m.group(2)}"
    return None


def _chunk_id(source, lesson, page, ordinal, text):
    digest = hashlib.sha1(
        f"{source}|{lesson}|{page}|{ordinal}|{text}".encode("utf-8")
    ).hexdigest()[:16]
    return f"cur_{digest}"


class _Accumulator:
    def __init__(self):
        self.blocks = []
        self.content_type = "explanation"
        self.section_title = None
        self.page_start = None
        self.page_end = None

    @property
    def text(self):
        return "\n".join(b["text"] for b in self.blocks).strip()

    def add(self, block, page_number):
        self.blocks.append(block)
        if self.page_start is None:
            self.page_start = page_number
        self.page_end = page_number

    def reset(self):
        self.blocks = []
        self.page_start = None
        self.page_end = None


def build_chunks(cleaned_pages, meta, toc_lookup):
    """Turn cleaned pages into metadata-rich chunks."""
    chunks = []
    acc = _Accumulator()
    current_lesson = None
    ordinal = 0

    def flush():
        nonlocal ordinal
        text = acc.text
        if not text or not current_lesson:
            acc.reset()
            return
        lesson = toc_lookup.get(current_lesson, {})
        chapter_number = int(current_lesson.split("-")[0])
        chapter = toc_lookup.get(f"chapter:{chapter_number}", {})
        ordinal += 1
        chunks.append(
            {
                "id": _chunk_id(meta["source"], current_lesson, acc.page_start, ordinal, text),
                "subject": meta["subject"],
                "subject_ar": meta["subject_ar"],
                "grade": meta["grade"],
                "grade_ar": meta["grade_ar"],
                "curriculum": meta["curriculum"],
                "curriculum_ar": meta["curriculum_ar"],
                "language": "ar",
                "term": meta["term"],
                "chapter_number": chapter_number,
                "chapter_title": chapter.get("title"),
                "lesson_number": current_lesson,
                "lesson_title": lesson.get("title"),
                "section_title": acc.section_title,
                "content_type": acc.content_type,
                "page_start": acc.page_start,
                "page_end": acc.page_end,
                "book_page_start": acc.page_start - meta["page_offset"],
                "book_page_end": acc.page_end - meta["page_offset"],
                "source": meta["source"],
                "source_file": meta["source_file"],
                "is_official_curriculum": True,
                "text": text,
                "char_count": len(text),
            }
        )
        acc.reset()

    for page in cleaned_pages:
        lesson = page.get("lesson_number")
        if lesson != current_lesson:
            flush()
            current_lesson = lesson
            acc.section_title = None
            acc.content_type = "explanation"
        if not current_lesson:
            continue

        for block in page["blocks"]:
            heading = _is_section_heading(block)
            marker = classify_marker(block["text"])

            if heading:
                flush()
                acc.section_title = heading
                acc.content_type = "explanation"
                acc.add(block, page["page_number"])
                continue

            if marker:
                flush()
                acc.content_type = marker
                acc.add(block, page["page_number"])
                continue

            limit = MAX_CHARS if acc.content_type in ATOMIC_TYPES else TARGET_CHARS
            if acc.blocks and len(acc.text) + len(block["text"]) > limit:
                flush()
            acc.add(block, page["page_number"])

    flush()
    return _dedupe(_merge_tiny(chunks))


def _merge_tiny(chunks):
    """Fold undersized fragments into the neighbour they belong with."""
    merged = []
    for chunk in chunks:
        if (
            merged
            and len(chunk["text"]) < MIN_CHARS
            and merged[-1]["lesson_number"] == chunk["lesson_number"]
            and len(merged[-1]["text"]) + len(chunk["text"]) <= MAX_CHARS
        ):
            prev = merged[-1]
            prev["text"] = f"{prev['text']}\n{chunk['text']}"
            prev["char_count"] = len(prev["text"])
            prev["page_end"] = chunk["page_end"]
            prev["book_page_end"] = chunk["book_page_end"]
            continue
        merged.append(chunk)
    return merged


def _dedupe(chunks):
    """Drop chunks whose text repeats one already emitted for the same lesson."""
    seen = {}
    out = []
    for chunk in chunks:
        key = (chunk["lesson_number"], chunk["text"].strip())
        if key in seen:
            continue
        seen[key] = chunk["id"]
        out.append(chunk)
    return out
