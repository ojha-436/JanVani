"""Gemini's job here is understanding and explaining, never deciding.

- explain_evidence: turns an already-computed, rule-based evidence score
  into a plain-language explanation for an MP. Never sees raw complaint
  text, never decides the score — see evidence.py for the scoring logic.
- detect_schema / assess_data_quality / explain_import: the government-data
  upload pipeline (see api/gov_data.py). Gemini only maps unfamiliar column
  names onto our fixed target schema and flags data-quality concerns —
  which rows get stored, and under what category, is decided by Python
  against Gemini's structured output, not by trusting free-form text."""

import json
import os

from google import genai
from google.genai import types

_client: genai.Client | None = None

_TARGET_SCHEMA_FIELDS = ["district", "category", "metric_name", "metric_value", "year"]
_KNOWN_CATEGORIES = ["education", "health", "roads", "water", "agriculture", "pollution", "other"]


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            vertexai=True,
            project=os.environ.get("GOOGLE_CLOUD_PROJECT", "vipasana-499205"),
            location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
        )
    return _client


def explain_evidence(score: int, level: str, reasons: list[str], facts: dict) -> str:
    prompt = f"""You are explaining a data-driven priority score to a Member of Parliament (MP).
Do not invent any new facts, numbers, or recommendations — only explain what is given below, in plain,
clear English suitable for a government briefing.

Evidence score: {score}/100 ({level} priority)

Reasons (already computed from real complaint and government data, not AI-generated):
{chr(10).join(f"- {r}" for r in reasons) or "- No specific factors met the scoring thresholds"}

Underlying facts:
{facts}

Write a 2-3 sentence explanation for the MP using ONLY the facts above. Do not add any claim that
isn't directly supported by the reasons or facts listed."""

    response = _get_client().models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=prompt,
    )
    return response.text or ""


def _generate_json(prompt: str) -> dict:
    response = _get_client().models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
    )
    return json.loads(response.text or "{}")


def detect_schema(sample_rows: list[dict]) -> dict:
    """AI step 1 of the upload pipeline: figure out what an unfamiliar
    file's columns mean. Returns a mapping proposal only — nothing here is
    written to the database until the caller (api/gov_data.py) applies it."""
    prompt = f"""You are a data engineer mapping a government dataset's columns onto a fixed target schema.
Do not invent data, only describe the columns given below.

Categories to choose from (pick exactly one): {_KNOWN_CATEGORIES}

Sample rows (JSON):
{json.dumps(sample_rows[:5], default=str)}

Respond with ONLY a JSON object of this exact shape:
{{
  "category": one of the categories above,
  "district_column": the column name that identifies a place/district/village, or null if none exists,
  "metric_columns": a list of column names that hold numeric statistics worth keeping,
  "confidence": an integer 0-100 for how confident you are in this mapping
}}"""
    result = _generate_json(prompt)
    result.setdefault("category", "other")
    result.setdefault("district_column", None)
    result.setdefault("metric_columns", [])
    result.setdefault("confidence", 0)
    return result


def assess_data_quality(rows: list[dict], mapping: dict) -> dict:
    """AI step 2: flag data-quality concerns in the proposed mapping applied
    to a sample of rows. This never blocks or approves an import by itself —
    api/gov_data.py decides commit vs needs_review using mapping confidence
    and this output together."""
    prompt = f"""You are checking government data quality. Do not invent issues that aren't visible in the sample.

Proposed mapping: {json.dumps(mapping, default=str)}

Sample rows after this mapping would be applied (JSON, first {min(len(rows), 10)} of {len(rows)} total rows):
{json.dumps(rows[:10], default=str)}

Respond with ONLY a JSON object of this exact shape:
{{
  "usable": true or false,
  "issues": a list of short strings describing concrete problems found (missing values, inconsistent units, non-numeric metrics, duplicate districts, etc.), empty list if none,
  "estimated_valid_rows": integer estimate of how many of the {len(rows)} total rows look usable
}}"""
    result = _generate_json(prompt)
    result.setdefault("usable", False)
    result.setdefault("issues", [])
    result.setdefault("estimated_valid_rows", 0)
    return result


def transcribe_audio(audio_url: str, locale: str = "en") -> str | None:
    """Transcribes a citizen's voice complaint (already uploaded to Firebase
    Storage by the client — see storage.rules) so it has searchable text
    like any other complaint. Uses Gemini's native audio understanding
    instead of a separate Speech-to-Text API call, since Gemini/Vertex AI
    is already the one external service this backend depends on. Returns
    None on any failure so a transcription hiccup never blocks a citizen's
    submission — see api/complaints.py."""
    from app import media

    result = media.fetch_bytes(audio_url)
    if result is None:
        return None
    audio_bytes, content_type = result

    prompt = (
        f"Transcribe this citizen's spoken complaint exactly as said, in its original language "
        f"(expected locale: {locale}). Return only the transcript text, nothing else — no labels, "
        f"no translation, no commentary."
    )
    try:
        response = _get_client().models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=content_type),
                prompt,
            ],
        )
        text = (response.text or "").strip()
        return text or None
    except Exception:
        return None


def analyze_photo(photo_url: str) -> dict | None:
    """Analyzes a citizen's uploaded photo (Firebase Storage — see
    storage.rules) for two purposes: (1) filling in text for photo-only
    submissions, same as transcribe_audio() does for voice, and (2)
    supplying one input signal to the verification engine (verification.py)
    — a confidence score for whether a real, visible issue is shown. Uses
    Gemini's native vision understanding rather than a separate Vision API
    call. This function only reports what it sees; it never decides a
    complaint's final verification status — see verification.py for that.
    Returns None on any failure so a hiccup never blocks submission."""
    from app import media

    result = media.fetch_bytes(photo_url)
    if result is None:
        return None
    image_bytes, content_type = result

    prompt = """Look at this photo of a citizen-reported civic issue. Only describe what is visibly evident —
do not guess a cause or location not shown.

Respond with ONLY a JSON object of this exact shape:
{
  "description": one short sentence describing the issue, written as if the citizen is reporting it
    (e.g. a damaged road, overflowing garbage, a broken streetlight, waterlogging, an unfinished building),
  "issue_visible": true or false — whether a genuine civic problem is clearly visible in the photo,
  "confidence": integer 0-100 for how clearly the photo shows a real, verifiable issue
}"""
    try:
        response = _get_client().models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[types.Part.from_bytes(data=image_bytes, mime_type=content_type), prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
        )
        result = json.loads(response.text or "{}")
        result.setdefault("description", None)
        result.setdefault("issue_visible", False)
        result.setdefault("confidence", 0)
        return result
    except Exception:
        return None


def find_common_cause(complaints: list[dict]) -> dict:
    """Given several nearby complaints already grouped by location (see
    consensus.py), asks whether they plausibly share one root cause. This
    is a hypothesis for a human to verify, not a stored fact — Gemini never
    decides which complaints are 'nearby'; consensus.py forms the cluster
    with plain GPS-grid bucketing before this is ever called."""
    prompt = f"""These citizen complaints were raised in the same local area. Based only on their text and
category, is there a plausible single root cause connecting some or all of them? If you are not confident,
say so with a low confidence score rather than guessing.

Complaints:
{json.dumps(complaints, default=str)}

Respond with ONLY a JSON object of this exact shape:
{{
  "root_cause": a one-sentence hypothesis for a shared root cause, or null if none is plausible,
  "confidence": integer 0-100,
  "linked_categories": a list of the categories you believe are connected by this root cause
}}"""
    result = _generate_json(prompt)
    result.setdefault("root_cause", None)
    result.setdefault("confidence", 0)
    result.setdefault("linked_categories", [])
    return result


def explain_import(category: str, row_count: int, district_count: int, sample_metrics: dict) -> str:
    """AI step 3: plain-language summary of what was imported, for the MP's
    import history view. Purely descriptive — written after the row count
    and district count are already fixed by the database insert."""
    prompt = f"""Summarize this government data import for a Member of Parliament (MP) in 1-2 sentences.
Do not add any claim not supported by the facts below.

Category: {category}
Rows imported: {row_count}
Distinct districts/locations: {district_count}
Sample metrics seen: {json.dumps(sample_metrics, default=str)}"""

    response = _get_client().models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=prompt,
    )
    return response.text or ""
