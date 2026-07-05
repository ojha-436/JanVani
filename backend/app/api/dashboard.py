from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.consensus import find_consensus_clusters
from app.database import get_db
from app.deps import get_current_mp
from app.evidence import compute_evidence
from app.models.complaint import Complaint
from app.models.mp_allowlist import MPAllowlistEntry
from app.schemas.dashboard import (
    CategoryCount,
    ConsensusClusterOut,
    DashboardSummary,
    EvidenceOut,
    MapPoint,
    RecentComplaint,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/evidence", response_model=EvidenceOut)
def get_evidence(mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    result = compute_evidence(mp, db)

    explanation = None
    try:
        from app.gemini_client import explain_evidence

        explanation = explain_evidence(result.score, result.level, result.reasons, result.facts)
    except Exception:
        pass  # Explanation is a nice-to-have — the score/reasons above are already complete on their own.

    return EvidenceOut(
        score=result.score, level=result.level, reasons=result.reasons, facts=result.facts, explanation=explanation
    )


@router.get("/summary", response_model=DashboardSummary)
def get_summary(mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    # An MP with no constituency set on their allowlist entry (not yet
    # configured by the admin) sees nothing rather than everyone else's
    # complaints — fail closed, not open.
    if not mp.constituency:
        return DashboardSummary(total_complaints=0, distinct_locations=0, by_category=[], recent=[], map_points=[])

    scope = Complaint.constituency == mp.constituency

    total_complaints = db.execute(select(func.count(Complaint.id)).where(scope)).scalar_one()

    distinct_locations = db.execute(
        select(func.count(func.distinct(Complaint.location))).where(scope, Complaint.location.is_not(None))
    ).scalar_one()

    category_rows = db.execute(
        select(Complaint.category, func.count(Complaint.id))
        .where(scope)
        .group_by(Complaint.category)
        .order_by(func.count(Complaint.id).desc())
    ).all()
    by_category = [
        CategoryCount(category=cat or "Uncategorized", count=count) for cat, count in category_rows
    ]

    recent_rows = db.execute(
        select(Complaint).where(scope).order_by(Complaint.created_at.desc()).limit(20)
    ).scalars().all()
    recent = [
        RecentComplaint(
            id=c.id,
            text=c.text,
            category=c.category,
            location=c.location,
            anonymous=c.anonymous,
            created_at=c.created_at,
            has_audio=c.audio_url is not None,
            has_photo=c.photo_url is not None,
            verification_confidence=c.verification_confidence,
            verification_status=c.verification_status,
        )
        for c in recent_rows
    ]

    map_rows = db.execute(
        select(Complaint)
        .where(scope, Complaint.lat.is_not(None), Complaint.lng.is_not(None))
        .order_by(Complaint.created_at.desc())
        .limit(300)
    ).scalars().all()
    map_points = [
        MapPoint(id=c.id, lat=c.lat, lng=c.lng, category=c.category, location=c.location) for c in map_rows
    ]

    return DashboardSummary(
        total_complaints=total_complaints,
        distinct_locations=distinct_locations,
        by_category=by_category,
        recent=recent,
        map_points=map_points,
    )


@router.get("/consensus", response_model=list[ConsensusClusterOut])
def get_consensus(mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    if not mp.constituency:
        return []

    clusters = find_consensus_clusters(mp.constituency, db)
    return [
        ConsensusClusterOut(
            location_hint=c.location_hint,
            complaint_count=len(c.complaint_ids),
            categories=c.categories,
            root_cause=c.root_cause,
            confidence=c.confidence,
        )
        for c in clusters
    ]
