"""Deterministic category suggestion for the citizen submit flow.

Same core rule as evidence.py/ranking.py: nothing here guesses. A fixed,
readable keyword table maps complaint text to the canonical categories;
the citizen always confirms or overrides the suggestion in the UI. This
deliberately does NOT call Gemini — suggestions must be identical for
identical text, cost nothing, and work in every environment (local dev
has no Vertex AI access).
"""

import re

# The 7 canonical categories used across seed data, verification and the
# dashboard. Keywords cover English and Hindi (Devanagari) because those
# are the two languages with full UI dictionaries; other locales still
# get English matching.
KEYWORD_MAP: dict[str, list[str]] = {
    "Roads": [
        "road", "pothole", "street", "highway", "footpath", "pavement", "speed breaker",
        "traffic", "bridge", "flyover", "streetlight", "street light",
        "सड़क", "गड्ढा", "गड्ढे", "पुल", "फुटपाथ", "रास्ता", "स्ट्रीट लाइट", "यातायात", "हाईवे",
    ],
    "Water Supply": [
        "water", "pipeline", "tap", "borewell", "bore well", "handpump", "hand pump",
        "tanker", "leakage", "drinking", "supply",
        "पानी", "जल", "नल", "पाइपलाइन", "बोरवेल", "हैंडपंप", "टैंकर", "रिसाव", "पेयजल",
    ],
    "Education": [
        "school", "teacher", "education", "classroom", "student", "college",
        "anganwadi", "midday meal", "mid-day meal", "books", "scholarship",
        "स्कूल", "विद्यालय", "शिक्षक", "शिक्षा", "छात्र", "कक्षा", "आंगनवाड़ी", "किताब", "छात्रवृत्ति",
    ],
    "Healthcare": [
        "hospital", "doctor", "clinic", "medicine", "ambulance", "health",
        "dispensary", "nurse", "vaccination", "phc",
        "अस्पताल", "डॉक्टर", "दवा", "दवाई", "एम्बुलेंस", "स्वास्थ्य", "क्लिनिक", "नर्स", "टीकाकरण",
    ],
    "Electricity": [
        "electricity", "power", "power cut", "transformer", "voltage", "wire",
        "electric", "meter", "connection", "load shedding",
        "बिजली", "विद्युत", "ट्रांसफार्मर", "वोल्टेज", "तार", "मीटर", "कनेक्शन", "कटौती",
    ],
    "Sanitation": [
        "garbage", "waste", "drain", "drainage", "sewer", "sewage", "toilet",
        "cleaning", "dump", "trash", "gutter",
        "कचरा", "कूड़ा", "नाली", "नाला", "सीवर", "शौचालय", "सफाई", "गंदगी",
    ],
    "Public Safety": [
        "police", "theft", "crime", "unsafe", "safety", "cctv", "patrol",
        "harassment", "robbery", "accident",
        "पुलिस", "चोरी", "अपराध", "असुरक्षित", "सुरक्षा", "सीसीटीवी", "गश्त", "दुर्घटना", "छेड़खानी",
    ],
}


def _matches(keyword: str, text_lower: str) -> bool:
    # Whole-word match (plus naive plural: pothole/potholes) for Latin
    # keywords so "tap" doesn't fire on "tape"; plain substring for
    # Devanagari, where word boundaries (\b) don't apply and
    # agglutination is common.
    if re.fullmatch(r"[a-z\s-]+", keyword):
        return re.search(rf"\b{re.escape(keyword)}(?:s|es)?\b", text_lower) is not None
    return keyword in text_lower


def suggest_categories(text: str, max_suggestions: int = 3) -> list[tuple[str, list[str]]]:
    """Rank categories by how many distinct keywords the text hits.

    Returns up to `max_suggestions` of (category, matched_keywords),
    strongest first; ties break alphabetically so output is fully
    deterministic. Empty list when nothing matches — the UI simply shows
    no chips.
    """
    text_lower = text.lower()
    scored: list[tuple[str, list[str]]] = []
    for category in sorted(KEYWORD_MAP):
        matched = [kw for kw in KEYWORD_MAP[category] if _matches(kw, text_lower)]
        if matched:
            scored.append((category, matched))
    scored.sort(key=lambda item: (-len(item[1]), item[0]))
    return scored[:max_suggestions]
