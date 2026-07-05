import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import gemini_client, media
from app.app_check import verify_app_check
from app.database import get_db
from app.deps import get_current_mp, get_current_user
from app.models.complaint import Complaint
from app.models.mp_allowlist import MPAllowlistEntry
from app.models.user import User
from app.schemas.complaint import ComplaintCreate, ComplaintOut
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
    mp: MPAllowlistEntry = Depends(get_current_mp),
    db: Session = Depends(get_db),
):
    # Previously had no auth at all — anyone could list every citizen's
    # complaints (including media URLs). Scoped to the requesting MP's own
    # constituency, same fail-closed pattern as dashboard.py.
    stmt = (
        select(Complaint)
        .where(Complaint.constituency == mp.constituency)
        .order_by(Complaint.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_to_out(c) for c in db.execute(stmt).scalars().all()]


@router.get("/{complaint_id}", response_model=ComplaintOut)
def get_complaint(complaint_id: uuid.UUID, mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    complaint = db.get(Complaint, complaint_id)
    if complaint is None or complaint.constituency != mp.constituency:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return _to_out(complaint)
