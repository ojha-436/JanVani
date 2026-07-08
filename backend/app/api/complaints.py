import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import gemini_client, media
from app.app_check import verify_app_check
from app.classify import suggest_categories
from app.database import get_db
from app.deps import get_current_mp, get_current_user
from app.models.complaint import Complaint
from app.models.mp_allowlist import MPAllowlistEntry
from app.models.status_notification import StatusNotification
from app.models.user import User
from app.schemas.complaint import (
    CategorySuggestionOut,
    ComplaintCreate,
    ComplaintOut,
    MyComplaintOut,
    NearbyComplaintOut,
    StatusHistoryEntry,
    SuggestCategoryIn,
    SuggestCategoryOut,
)
from app.verification import verify_complaint

router = APIRouter(prefix="/complaints", tags=["complaints"])


def _to_out(complaint: Complaint) -> ComplaintOut:
    # audio_url/photo_url are stored as the raw Firebase Storage download
    # URL, but storage.rules now denies direct public read (see
    # storage.rules) — every response mints a fresh, short-lived signed URL
    # instead, via the Admin SDK (app/media.py), which bypasses Security
    # Rules. Nothing durable is ever handed to a client.
    return ComplaintOut(
        id=complaint.id,
        text=complaint.text,
        locale=complaint.locale,
        category=complaint.category,
        location=complaint.location,
        lat=complaint.lat,
        lng=complaint.lng,
        anonymous=complaint.anonymous,
        status=complaint.status,
        assigned_department=complaint.assigned_department,
        created_at=complaint.created_at,
        audio_url=media.signed_url(complaint.audio_url),
        photo_url=media.signed_url(complaint.photo_url),
        verification_confidence=complaint.verification_confidence,
        verification_status=complaint.verification_status,
        verification_reasons=complaint.verification_reasons,
    )


@router.post("", response_model=ComplaintOut, status_code=201, dependencies=[Depends(verify_app_check)])
def create_complaint(
    payload: ComplaintCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    # Voice-mode submissions arrive with empty text — transcribe the
    # already-uploaded audio so the complaint has real text, same as any
    # other. Never let a transcription failure block submission.
    if not data["text"].strip() and data.get("audio_url"):
        transcript = gemini_client.transcribe_audio(data["audio_url"], data.get("locale", "en"))
        if transcript:
            data["text"] = transcript

    # A photo is analyzed whenever present — not just to fill in empty text
    # (photo-only submissions) but because verify_complaint() below needs
    # its confidence signal regardless of whether text was also provided.
    photo_analysis = None
    if data.get("photo_url"):
        photo_analysis = gemini_client.analyze_photo(data["photo_url"])
        if photo_analysis and not data["text"].strip() and photo_analysis.get("description"):
            data["text"] = photo_analysis["description"]

    # constituency is a snapshot of the submitter's profile at submission
    # time, set server-side — never trust a client-supplied value.
    complaint = Complaint(**data, user_id=user.id, constituency=user.constituency)
    db.add(complaint)
    db.flush()  # assigns complaint.id without committing, for verify_complaint's self-exclusion check

    district = None
    if user.constituency:
        mp_entry = db.execute(
            select(MPAllowlistEntry).where(MPAllowlistEntry.constituency == user.constituency)
        ).scalars().first()
        district = mp_entry.district if mp_entry else None

    result = verify_complaint(complaint, db, photo_analysis=photo_analysis, district=district)
    complaint.verification_confidence = result.confidence
    complaint.verification_status = result.status
    complaint.verification_reasons = result.reasons

    db.commit()
    db.refresh(complaint)
    return _to_out(complaint)


@router.get("", response_model=list[ComplaintOut])
def list_complaints(
    limit: int = 50,
    offset: int = 0,
    category: str | None = None,
    status: str | None = None,
    mp: MPAllowlistEntry = Depends(get_current_mp),
    db: Session = Depends(get_db),
):
    # Previously had no auth at all — anyone could list every citizen's
    # complaints (including media URLs). Scoped to the requesting MP's own
    # constituency, same fail-closed pattern as dashboard.py. category/status
    # are optional drill-down filters used by the dashboard's exploration panel.
    stmt = select(Complaint).where(Complaint.constituency == mp.constituency)
    if category is not None:
        stmt = stmt.where(Complaint.category == category)
    if status is not None:
        stmt = stmt.where(Complaint.status == status)
    stmt = stmt.order_by(Complaint.created_at.desc()).limit(limit).offset(offset)
    return [_to_out(c) for c in db.execute(stmt).scalars().all()]


# NOTE: the literal paths below (/mine, /nearby, /suggest-category) must be
# declared BEFORE /{complaint_id}, or FastAPI would try to parse them as a
# UUID path param and 422.


@router.get("/mine", response_model=list[MyComplaintOut])
def list_my_complaints(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    complaints = db.execute(
        select(Complaint)
        .where(Complaint.user_id == user.id)
        .order_by(Complaint.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    # One query for every fetched complaint's transitions (not one per
    # row); status_notifications doubles as the status-history ledger —
    # rows are never deleted, delivered_at only marks citizen delivery.
    history_map: dict[uuid.UUID, list[StatusHistoryEntry]] = {}
    if complaints:
        rows = db.execute(
            select(StatusNotification)
            .where(StatusNotification.complaint_id.in_([c.id for c in complaints]))
            .order_by(StatusNotification.created_at.asc())
        ).scalars().all()
        for n in rows:
            history_map.setdefault(n.complaint_id, []).append(
                StatusHistoryEntry(old_status=n.old_status, new_status=n.new_status, changed_at=n.created_at)
            )

    return [
        MyComplaintOut(
            id=c.id,
            text=c.text,
            category=c.category,
            location=c.location,
            anonymous=c.anonymous,
            status=c.status,
            assigned_department=c.assigned_department,
            created_at=c.created_at,
            audio_url=media.signed_url(c.audio_url),
            photo_url=media.signed_url(c.photo_url),
            verification_confidence=c.verification_confidence,
            verification_status=c.verification_status,
            verification_reasons=c.verification_reasons,
            status_history=history_map.get(c.id, []),
        )
        for c in complaints
    ]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@router.get("/nearby", response_model=list[NearbyComplaintOut])
def list_nearby_complaints(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=3.0, gt=0, le=10),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Nearby open issues for the submit-flow mini-map. Citizen-facing, so
    the payload is anonymized (see NearbyComplaintOut) — no ids, text or
    media that could identify a complainant."""
    # Cheap bounding-box prefilter in SQL (no PostGIS on this instance),
    # exact haversine cut in Python.
    lat_delta = radius_km / 111.0  # ~111 km per degree latitude
    lng_delta = radius_km / max(0.1, 111.0 * math.cos(math.radians(lat)))
    candidates = db.execute(
        select(Complaint)
        .where(
            Complaint.lat.is_not(None),
            Complaint.lng.is_not(None),
            Complaint.lat.between(lat - lat_delta, lat + lat_delta),
            Complaint.lng.between(lng - lng_delta, lng + lng_delta),
        )
        .order_by(Complaint.created_at.desc())
        .limit(500)
    ).scalars().all()

    within = [
        (c, _haversine_km(lat, lng, c.lat, c.lng))
        for c in candidates
        if _haversine_km(lat, lng, c.lat, c.lng) <= radius_km
    ]
    within.sort(key=lambda pair: pair[1])
    return [
        NearbyComplaintOut(category=c.category, status=c.status, lat=c.lat, lng=c.lng, created_at=c.created_at)
        for c, _ in within[:limit]
    ]


@router.post("/suggest-category", response_model=SuggestCategoryOut)
def suggest_category(
    payload: SuggestCategoryIn,
    user: User = Depends(get_current_user),
):
    text = payload.text.strip()
    if len(text) > 2000:
        raise HTTPException(status_code=422, detail="text must be at most 2000 characters")
    suggestions = suggest_categories(text) if text else []
    return SuggestCategoryOut(
        suggestions=[CategorySuggestionOut(category=cat, matched_keywords=kws) for cat, kws in suggestions],
        source="keywords",
    )


@router.get("/{complaint_id}", response_model=ComplaintOut)
def get_complaint(complaint_id: uuid.UUID, mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    complaint = db.get(Complaint, complaint_id)
    if complaint is None or complaint.constituency != mp.constituency:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return _to_out(complaint)
