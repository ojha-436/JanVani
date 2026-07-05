"""Per-complaint evidence verification — same no-guessing principle as
evidence.py: a confidence score and status computed by Python from
independent signals, never invented by AI. Gemini supplies exactly one
input signal here (photo analysis, via gemini_client.analyze_photo) — it
does not decide the final score or status."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.complaint import Complaint
from app.models.gov_data_import import GovDataRecord


@dataclass
class VerificationResult:
    confidence: int
    status: str
    reasons: list[str] = field(default_factory=list)


def verify_complaint(
    complaint: Complaint,
    db: Session,
    photo_analysis: dict | None = None,
    district: str | None = None,
) -> VerificationResult:
    score = 0
    reasons: list[str] = []

    if photo_analysis and photo_analysis.get("issue_visible"):
        photo_confidence = int(photo_analysis.get("confidence") or 0)
        score += round(photo_confidence * 0.4)
        reasons.append(f"AI photo analysis: {photo_confidence}% confidence a real issue is visible")

    if complaint.lat is not None and complaint.lng is not None:
        score += 15
        reasons.append("Location pinned via GPS")

    if complaint.category and complaint.constituency:
        since = datetime.now(timezone.utc) - timedelta(days=90)
        nearby_count = db.execute(
            select(func.count(Complaint.id)).where(
                Complaint.id != complaint.id,
                Complaint.category == complaint.category,
                Complaint.constituency == complaint.constituency,
                Complaint.created_at >= since,
            )
        ).scalar_one()
        if nearby_count > 0:
            score += min(30, nearby_count * 5)
            reasons.append(
                f"{nearby_count} other complaint(s) in the same category in this constituency (last 90 days)"
            )

    if district and complaint.category:
        gov_match = db.execute(
            select(func.count(GovDataRecord.id)).where(
                GovDataRecord.district == district,
                func.lower(GovDataRecord.category) == func.lower(complaint.category),
            )
        ).scalar_one()
        if gov_match > 0:
            score += 15
            reasons.append(f"Government data on record for {complaint.category} in {district} district")

    score = min(score, 100)
    if score >= 70:
        status = "Strong"
    elif score >= 40:
        status = "Moderate"
    else:
        status = "Weak"

    if not reasons:
        reasons.append("No independent evidence yet — based on the citizen's report alone")

    return VerificationResult(confidence=score, status=status, reasons=reasons)
