"""Section markers used consistently throughout both curriculum volumes.

Kept in its own module because both the cleaner (which must not merge a
marker heading into the paragraph beneath it) and the structure detector
need them.
"""

import re

NUMBERED_SECTION = re.compile(r"^(\d+)\s*[.．]\s*(\S.+)$")

# Order matters: the first match wins, so longer / more specific markers
# come first.
CONTENT_MARKERS = [
    ("أهداف التعلم", "learning_objectives"),
    ("خريطة الدرس", "lesson_map"),
    ("الفكرة الأساسية", "main_idea"),
    ("الفكرة الرئيسة", "main_idea"),
    ("المفاهيم الأساسية", "key_concepts"),
    ("مسار التعلم", "learning_path"),
    ("مصطلحات أساسية", "terminology"),
    ("سؤال على نمط الامتحان", "exam_style_question"),
    ("إجابة السؤال الرئيسي", "key_question_answer"),
    ("السؤال الرئيسي", "key_question"),
    ("مثال محلول", "solved_example"),
    ("ملحوظة مهمّة", "important_note"),
    ("ملحوظة مهمة", "important_note"),
    ("توقّف وفكّر", "reflection"),
    ("توقف وفكر", "reflection"),
    ("فكر وتحّد نفسك", "challenge"),
    ("فكر وتحد نفسك", "challenge"),
    ("فكر كمهندس", "engineering_task"),
    ("طبّق ما تعلمته", "application"),
    ("طبق ما تعلمته", "application"),
    ("استكشف", "activity"),
    ("الخلاصة", "summary"),
    ("تمارين", "exercises"),
    ("تدرّب", "practice"),
    ("تدرب", "practice"),
    ("الحلّ", "solution"),
    ("الحل", "solution"),
    ("راجع إجاباتك", "review"),
]

def strip_icons(text):
    return re.sub(r"^[^\w؀-ۿ(]+", "", text).strip()


def classify_marker(text):
    """Return a content type if this text is a known section marker heading."""
    head = strip_icons(text)
    if len(head) > 60:
        return None
    for marker, kind in CONTENT_MARKERS:
        if head.startswith(marker):
            return kind
    return None
