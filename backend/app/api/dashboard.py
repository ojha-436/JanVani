import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import media
from app.consensus import find_consensus_clusters
from app.database import get_db
from app.deps import get_current_mp
from app.evidence import compute_evidence
from app.models.complaint import Complaint
from app.models.mp_allowlist import MPAllowlistEntry
from app.models.status_notification import StatusNotification
from app.ranking import compute_ranked_issues
from app.schemas.dashboard import (
    AlertOut,
    CategoryCount,
    CompareOut,
    ComplaintStatusUpdate,
    ConsensusClusterOut,
    DashboardSummary,
    DepartmentProgress,
    EvidenceOut,
    MapPoint,
    PeriodStats,
    ProgressOut,
    RankedIssueOut,
    RecentComplaint,
    StatusCount,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# The only statuses an MP can move a complaint through — kept as a fixed set
# rather than a free-text field so the dashboard filter/badge logic never
# has to handle an unexpected value.
ALLOWED_STATUSES = {"new", "in_progress", "resolved", "rejected"}

# No department accounts/login exist yet — this is just a tracking tag the
# MP sets from the dashboard (see update_complaint_status below).
ALLOWED_DEPARTMENTS = {"PWD", "Health", "Education", "Water", "Sanitation", "Electricity", "Other"}


def _to_recent(c: Complaint) -> RecentComplaint:
    return RecentComplaint(
        id=c.id,
        text=c.text,
        category=c.category,
        location=c.location,
        anonymous=c.anonymous,
        status=c.status,
        assigned_department=c.assigned_department,
        created_at=c.created_at,
        has_audio=c.audio_url is not None,
        has_photo=c.photo_url is not None,
        audio_url=media.signed_url(c.audio_url),
        photo_url=media.signed_url(c.photo_url),
        verification_confidence=c.verification_confidence,
        verification_status=c.verification_status,
        verification_reasons=c.verification_reasons,
    )


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
def get_summary(
    recent_limit: int = 20,
    recent_offset: int = 0,
    mp: MPAllowlistEntry = Depends(get_current_mp),
    db: Session = Depends(get_db),
):
    # An MP with no constituency set on their allowlist entry (not yet
    # configured by the admin) sees nothing rather than everyone else's
    # complaints — fail closed, not open.
    if not mp.constituency:
        return DashboardSummary(
            total_complaints=0, distinct_locations=0, by_category=[], recent=[], recent_has_more=False, map_points=[]
        )

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

    # Fetch one extra row to know whether another page exists, without a
    # separate COUNT query.
    recent_rows = db.execute(
        select(Complaint).where(scope).order_by(Complaint.created_at.desc()).limit(recent_limit + 1).offset(recent_offset)
    ).scalars().all()
    recent_has_more = len(recent_rows) > recent_limit
    recent_rows = recent_rows[:recent_limit]
    recent = [_to_recent(c) for c in recent_rows]

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
        recent_has_more=recent_has_more,
        map_points=map_points,
    )


@router.patch("/complaints/{complaint_id}/status", response_model=RecentComplaint)
def update_complaint_status(
    complaint_id: uuid.UUID,
    payload: ComplaintStatusUpdate,
    mp: MPAllowlistEntry = Depends(get_current_mp),
    db: Session = Depends(get_db),
):
    if payload.status is None and payload.assigned_department is None:
        raise HTTPException(status_code=422, detail="Provide status and/or assigned_department")
    if payload.status is not None and payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(ALLOWED_STATUSES)}")
    if payload.assigned_department is not None and payload.assigned_department not in ALLOWED_DEPARTMENTS:
        raise HTTPException(status_code=422, detail=f"assigned_department must be one of {sorted(ALLOWED_DEPARTMENTS)}")

    complaint = db.get(Complaint, complaint_id)
    if complaint is None or complaint.constituency != mp.constituency:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if payload.status is not None and payload.status != complaint.status:
        # Queue an in-app notification for the citizen — a cheap insert, not
        # a push. See app/models/status_notification.py and
        # GET /users/me/notifications for the batched delivery side.
        if complaint.user_id is not None:
            db.add(
                StatusNotification(
                    complaint_id=complaint.id,
                    user_id=complaint.user_id,
                    old_status=complaint.status,
                    new_status=payload.status,
                )
            )
        complaint.status = payload.status
    if payload.assigned_department is not None:
        complaint.assigned_department = payload.assigned_department

    db.commit()
    db.refresh(complaint)
    return _to_recent(complaint)


@router.get("/ranked-issues", response_model=list[RankedIssueOut])
def get_ranked_issues(mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    issues = compute_ranked_issues(mp, db)
    return [
        RankedIssueOut(
            category=i.category,
            complaint_count=i.complaint_count,
            population=i.population,
            score=i.score,
            level=i.level,
            gov_data_summary=i.gov_data_summary,
            reasons=i.reasons,
        )
        for i in issues
    ]


@router.get("/progress", response_model=ProgressOut)
def get_progress(mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    if not mp.constituency:
        return ProgressOut(by_status=[], by_status_last_30_days=[], by_department=[])

    scope = Complaint.constituency == mp.constituency

    def status_counts(*extra_where):
        rows = db.execute(
            select(Complaint.status, func.count(Complaint.id))
            .where(scope, *extra_where)
            .group_by(Complaint.status)
        ).all()
        return [StatusCount(status=s, count=n) for s, n in rows]

    since_30 = datetime.now(timezone.utc) - timedelta(days=30)
    by_status = status_counts()
    by_status_last_30_days = status_counts(Complaint.created_at >= since_30)

    dept_rows = db.execute(
        select(Complaint.assigned_department, Complaint.status, func.count(Complaint.id))
        .where(scope, Complaint.assigned_department.is_not(None))
        .group_by(Complaint.assigned_department, Complaint.status)
    ).all()
    by_department_map: dict[str, list[StatusCount]] = {}
    for dept, status, count in dept_rows:
        by_department_map.setdefault(dept, []).append(StatusCount(status=status, count=count))
    by_department = [DepartmentProgress(department=d, by_status=s) for d, s in by_department_map.items()]

    return ProgressOut(
        by_status=by_status, by_status_last_30_days=by_status_last_30_days, by_department=by_department
    )


def _period_stats(scope, start: datetime, end: datetime, db: Session) -> PeriodStats:
    window = (Complaint.created_at >= start, Complaint.created_at < end)
    total = db.execute(select(func.count(Complaint.id)).where(scope, *window)).scalar() or 0
    resolved = db.execute(
        select(func.count(Complaint.id)).where(scope, *window, Complaint.status == "resolved")
    ).scalar() or 0
    category_rows = db.execute(
        select(Complaint.category, func.count(Complaint.id))
        .where(scope, *window, Complaint.category.is_not(None))
        .group_by(Complaint.category)
        .order_by(func.count(Complaint.id).desc())
    ).all()
    return PeriodStats(
        from_date=start,
        to_date=end,
        total=total,
        resolved=resolved,
        by_category=[CategoryCount(category=cat, count=n) for cat, n in category_rows],
    )


@router.get("/compare", response_model=CompareOut)
def get_compare(
    days: int = Query(default=30, ge=7, le=180),
    mp: MPAllowlistEntry = Depends(get_current_mp),
    db: Session = Depends(get_db),
):
    """This period vs the previous period of equal length — plain grouped
    counts, so the dashboard's compare mode never shows a derived number
    the MP couldn't recompute from the complaint list itself."""
    now = datetime.now(timezone.utc)
    mid = now - timedelta(days=days)
    earliest = now - timedelta(days=2 * days)

    if not mp.constituency:
        empty = PeriodStats(from_date=mid, to_date=now, total=0, resolved=0, by_category=[])
        empty_prev = PeriodStats(from_date=earliest, to_date=mid, total=0, resolved=0, by_category=[])
        return CompareOut(current=empty, previous=empty_prev)

    scope = Complaint.constituency == mp.constituency
    return CompareOut(
        current=_period_stats(scope, mid, now, db),
        previous=_period_stats(scope, earliest, mid, db),
    )


@router.get("/alerts", response_model=list[AlertOut])
def get_alerts(
    since: datetime | None = None,
    min_confidence: int = Query(default=70, ge=0, le=100),
    mp: MPAllowlistEntry = Depends(get_current_mp),
    db: Session = Depends(get_db),
):
    """High-confidence complaints since `since` (default: last 24h) — feeds
    the dashboard notification bell. The threshold compares the stored
    rule-computed verification_confidence; nothing is rescored here."""
    if not mp.constituency:
        return []
    # Clients send ISO timestamps; naive values are treated as UTC because
    # every created_at in this schema is timezone-aware UTC.
    if since is None:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
    elif since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)

    rows = db.execute(
        select(Complaint)
        .where(
            Complaint.constituency == mp.constituency,
            Complaint.created_at > since,
            Complaint.verification_confidence >= min_confidence,
        )
        .order_by(Complaint.created_at.desc())
        .limit(20)
    ).scalars().all()
    return [
        AlertOut(
            id=c.id,
            category=c.category,
            location=c.location,
            verification_confidence=c.verification_confidence,
            verification_status=c.verification_status,
            created_at=c.created_at,
        )
        for c in rows
    ]


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
