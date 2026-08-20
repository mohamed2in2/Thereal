"""Curriculum ingestion entry point.

    python scripts/curriculum/ingest.py

Reads the official PDFs, rebuilds the Arabic text, detects the curriculum
structure, chunks it semantically and writes a knowledge base that the
application loads at runtime.  Re-running it over unchanged PDFs reproduces
byte-identical output, so ingestion is idempotent.
"""

import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pymupdf

from arabic_pdf import extract_document
from chunk import build_chunks
from clean import clean_document
from structure import assign_pages, parse_toc

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "src", "ai", "knowledge", "curriculum")

BASE_META = {
    "subject": "Programming and Artificial Intelligence",
    "subject_ar": "البرمجة والذكاء الاصطناعي",
    "grade": "Secondary 2",
    "grade_ar": "الصف الثاني الثانوي",
    "curriculum": "Egyptian Baccalaureate",
    "curriculum_ar": "البكالوريا المصرية",
}

VOLUMES = [
    {
        "term": 1,
        "source": "official_curriculum_part1",
        "source_file": "Programming-ArtificialIntelligence-Ar-EB-part1.pdf",
    },
    {
        "term": 2,
        "source": "official_curriculum_part2",
        "source_file": "Programming-ArtificialIntelligence-Ar-EB-part2_260819_202159.pdf",
    },
]


def detect_page_offset(pages):
    """Difference between PDF page index and the page number printed in the book."""
    from clean import is_page_number, normalise_text

    votes = collections.Counter()
    for page in pages:
        height = page["height"] or 1.0
        for line in page["lines"]:
            if line["y"] / height < 0.90:
                continue
            text = normalise_text(line["text"])
            if is_page_number(text) and text.isdigit():
                votes[page["page_number"] - int(text)] += 1
    return votes.most_common(1)[0][0] if votes else 0


def ingest_volume(volume):
    path = os.path.join(ROOT, volume["source_file"])
    pages = extract_document(path)
    toc = parse_toc(pages)
    cleaned, _ = clean_document(pages)
    header_titles = assign_pages(cleaned)

    lookup = {}
    for entry in toc:
        if entry["kind"] == "chapter":
            lookup[f"chapter:{entry['chapter_number']}"] = entry
        else:
            lookup[entry["lesson_number"]] = entry
    # Fall back to the running-head title for any lesson missing from the TOC.
    for lesson, title in header_titles.items():
        lookup.setdefault(lesson, {"title": title, "lesson_number": lesson})

    meta = dict(BASE_META)
    meta.update(volume)
    meta["page_offset"] = detect_page_offset(pages)

    chunks = build_chunks(cleaned, meta, lookup)
    return chunks, toc, cleaned, meta


def validate(chunks, toc_all):
    """Post-ingestion checks required before the knowledge base is trusted."""
    report = {}
    seen_text, duplicates = {}, []
    empty = []
    for chunk in chunks:
        text = chunk["text"].strip()
        if not text:
            empty.append(chunk["id"])
        key = text
        if key in seen_text:
            duplicates.append({"id": chunk["id"], "duplicate_of": seen_text[key]})
        else:
            seen_text[key] = chunk["id"]

    ids = [c["id"] for c in chunks]
    chapters = sorted({c["chapter_number"] for c in chunks})
    lessons = sorted({c["lesson_number"] for c in chunks})
    toc_lessons = sorted({e["lesson_number"] for e in toc_all if e["kind"] == "lesson"})

    report["chapters_detected"] = len(chapters)
    report["chapters"] = chapters
    report["lessons_detected"] = len(lessons)
    report["lessons_in_toc"] = len(toc_lessons)
    report["lessons_missing_content"] = [l for l in toc_lessons if l not in lessons]
    report["chunks_created"] = len(chunks)
    report["duplicate_chunk_ids"] = len(ids) - len(set(ids))
    report["duplicate_chunk_text"] = duplicates
    report["empty_chunks"] = empty
    report["chunks_without_lesson_title"] = sum(1 for c in chunks if not c["lesson_title"])
    report["content_type_distribution"] = dict(
        sorted(collections.Counter(c["content_type"] for c in chunks).items())
    )
    report["chunks_per_lesson"] = dict(
        sorted(
            collections.Counter(c["lesson_number"] for c in chunks).items(),
            key=lambda kv: (int(kv[0].split("-")[0]), int(kv[0].split("-")[1])),
        )
    )
    sizes = [c["char_count"] for c in chunks]
    report["char_count"] = {
        "total": sum(sizes),
        "min": min(sizes) if sizes else 0,
        "max": max(sizes) if sizes else 0,
        "mean": round(sum(sizes) / len(sizes)) if sizes else 0,
    }
    return report


def main():
    pymupdf.TOOLS.mupdf_display_errors(False)
    os.makedirs(OUT_DIR, exist_ok=True)

    all_chunks, all_toc, structure = [], [], []
    for volume in VOLUMES:
        chunks, toc, cleaned, meta = ingest_volume(volume)
        all_chunks.extend(chunks)
        all_toc.extend(toc)
        structure.append(
            {
                "term": meta["term"],
                "source_file": meta["source_file"],
                "page_offset": meta["page_offset"],
                "pages": len(cleaned),
                "chapters": [e for e in toc if e["kind"] == "chapter"],
                "lessons": [e for e in toc if e["kind"] == "lesson"],
            }
        )
        print(
            f"  {meta['source_file']}: {len(cleaned)} pages -> {len(chunks)} chunks",
            file=sys.stderr,
        )

    report = validate(all_chunks, all_toc)

    chunks_path = os.path.join(OUT_DIR, "curriculum_chunks.json")
    with open(chunks_path, "w", encoding="utf-8") as fh:
        json.dump(all_chunks, fh, ensure_ascii=False, indent=1)

    structure_path = os.path.join(OUT_DIR, "curriculum_structure.json")
    with open(structure_path, "w", encoding="utf-8") as fh:
        json.dump(
            {**BASE_META, "terms": structure, "validation": report},
            fh,
            ensure_ascii=False,
            indent=1,
        )

    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
