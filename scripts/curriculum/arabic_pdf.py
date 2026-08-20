"""High-fidelity Arabic text extraction from PDFs.

Why this exists instead of ``page.get_text()``:

The Egyptian Baccalaureate textbooks are laid out with justified Arabic text.
Two independent defects make the naive extraction unusable:

1. ``get_text()`` / ``rawdict`` silently DROP any Arabic letter that carries a
   combining diacritic, leaving the bare mark behind.  ``عامًا`` extracts as
   ``عاًا`` (the ``م`` vanishes).  ``get_texttrace()`` does not drop them.
2. Glyphs are emitted in the PDF content stream in placement order, not logical
   order, so words and letters come out visually reversed and lam-alef
   ligatures decompose backwards (``الاجتماعي`` -> ``االجتماعي``).

So we read glyphs via ``get_texttrace()`` (which also expands ligatures, marking
continuation glyphs with ``gid == -1``) and rebuild logical order from geometry:
right-to-left by glyph origin, with combining marks re-attached to the nearest
base letter and embedded Latin/digit runs flipped back to left-to-right.
"""

import re
import unicodedata

import pymupdf

# Characters that belong to an embedded left-to-right run inside Arabic text.
LTR_CORE = re.compile(r"[A-Za-z0-9]")
# Neutral characters allowed to sit *inside* an LTR run without breaking it.
LTR_NEUTRAL = set(" .,-_/:+#'\"()[]{}&=*%")

MIRROR = {"(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<"}

# Glyph origins on the same text line wobble slightly; group within this many points.
LINE_Y_TOLERANCE = 2.5


def _is_mark(ch: str) -> bool:
    return unicodedata.category(ch) == "Mn"


def _rebuild_line(chars):
    """Return logical-order text for one visual line of glyphs.

    ``chars`` is a list of dicts with ``c`` (character) and ``x`` (glyph origin).
    """
    chars = [c for c in chars if c["c"] and c["c"] != "\x00"]
    if not chars:
        return ""

    bases = [c for c in chars if not _is_mark(c["c"])]
    marks = [c for c in chars if _is_mark(c["c"])]

    # Right-to-left by glyph origin.  Python's sort is stable, so ligature
    # components sharing an origin (lam-alef) keep their emitted order, which is
    # already logical.
    bases.sort(key=lambda c: -c["x"])

    # Re-attach every combining mark immediately after whichever base letter it
    # is painted over (nearest glyph origin wins).
    attached = {}
    for m in marks:
        if not bases:
            continue
        idx = min(range(len(bases)), key=lambda i: abs(bases[i]["x"] - m["x"]))
        attached.setdefault(idx, []).append(m)

    ordered = []
    for i, b in enumerate(bases):
        ordered.append(b)
        for m in sorted(attached.get(i, []), key=lambda c: c["x"]):
            ordered.append(m)

    # The content stream stores glyphs in visual order, so every bracket carries
    # its *mirrored* shape.  Reading right-to-left restores the logical one.
    ordered = [{**c, "c": MIRROR.get(c["c"], c["c"])} for c in ordered]

    return _restore_ltr_runs(ordered)


def _restore_ltr_runs(ordered):
    """Flip embedded Latin/digit runs, which the RTL pass left reversed."""
    out = []
    i = 0
    n = len(ordered)
    while i < n:
        if LTR_CORE.match(ordered[i]["c"]):
            j = i
            last_core = i
            while j < n and (LTR_CORE.match(ordered[j]["c"]) or ordered[j]["c"] in LTR_NEUTRAL):
                if LTR_CORE.match(ordered[j]["c"]):
                    last_core = j
                j += 1
            # Only the span up to the final alphanumeric belongs to the run;
            # trailing neutrals (spaces, punctuation) stay in RTL flow.
            run = ordered[i : last_core + 1]
            out.extend(reversed(run))
            i = last_core + 1
        else:
            out.append(ordered[i])
            i += 1
    return "".join(c["c"] for c in out)


def extract_page(page):
    """Extract one page as a list of logical-order lines with layout metadata."""
    rows = {}
    for span in page.get_texttrace():
        if span.get("type") != 0:  # skip stroked/clipped decorative text
            continue
        font = span.get("font", "")
        size = round(span.get("size", 0.0), 1)
        color = span.get("color")
        for ucs, gid, origin, bbox in span["chars"]:
            if ucs <= 0:
                continue
            ch = chr(ucs)
            key = round(origin[1] / LINE_Y_TOLERANCE)
            rows.setdefault(key, []).append(
                {
                    "c": ch,
                    "x": origin[0],
                    "y": origin[1],
                    "bbox": bbox,
                    "font": font,
                    "size": size,
                    "color": color,
                }
            )

    lines = []
    for key in sorted(rows):
        for chars in _split_columns(rows[key]):
            text = _rebuild_line(chars).strip()
            if not text:
                continue
            sizes = [c["size"] for c in chars]
            fonts = [c["font"] for c in chars]
            colors = [c["color"] for c in chars]
            lines.append(
                {
                    "text": text,
                    "y": min(c["y"] for c in chars),
                    "x0": min(c["bbox"][0] for c in chars),
                    "x1": max(c["bbox"][2] for c in chars),
                    "size": max(sizes),
                    "font": max(set(fonts), key=fonts.count),
                    "color": max(set(colors), key=colors.count),
                }
            )
    # Arabic reading order: top to bottom, then right to left within a band.
    lines.sort(key=lambda l: (round(l["y"] / LINE_Y_TOLERANCE), -l["x1"]))
    return lines


def _split_columns(chars):
    """Split one horizontal band of glyphs into separate columns / table cells.

    A single y-band can contain body text, a margin sidebar and several table
    cells.  Concatenating them produces sentences that never existed, so we cut
    the band wherever a horizontal gap is far wider than the local space width.
    """
    ordered = sorted(chars, key=lambda c: c["bbox"][0])
    widths = [c["bbox"][2] - c["bbox"][0] for c in ordered if not _is_mark(c["c"])]
    typical = sorted(widths)[len(widths) // 2] if widths else 4.0
    threshold = max(3.0 * max(typical, 2.0), 12.0)

    groups = [[ordered[0]]]
    right = ordered[0]["bbox"][2]
    for c in ordered[1:]:
        if c["bbox"][0] - right > threshold:
            groups.append([])
        groups[-1].append(c)
        right = max(right, c["bbox"][2])
    return groups


def extract_document(path):
    """Extract every page of a PDF as logical-order lines."""
    doc = pymupdf.open(path)
    pages = []
    for number, page in enumerate(doc, start=1):
        pages.append(
            {
                "page_number": number,
                "width": page.rect.width,
                "height": page.rect.height,
                "lines": extract_page(page),
            }
        )
    doc.close()
    return pages
