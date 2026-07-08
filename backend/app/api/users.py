from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.civic import compute_civic_standing
from app.database import get_db
from app.deps import get_current_user
from app.models.complaint import Complaint
from app.models.status_notification import StatusNotification
from app.models.user import User
from app.schemas.user import MyStatsOut, NotificationOut, ProfileUpdate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.first_name = payload.first_name.strip()
    user.last_name = payload.last_name.strip()
    user.address = payload.address.strip()
    user.constituency = payload.constituency.strip()
    user.pincode = payload.pincode.strip()
    user.state = payload.state.strip()

    # Only the last 4 digits are ever persisted — the full number is
    # discarded immediately after this request completes.
    if payload.aadhaar is not None:
        user.aadhaar_last4 = payload.aadhaar[-4:]

    db.commit()
    db.refresh(user)
    return user


@router.get("/me/notifications", response_model=list[NotificationOut])
def get_my_notifications(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Batched, pull-based delivery — see app/models/status_notification.py.
    Capping to `limit` and marking rows delivered in this same request means
    an MP bulk-updating many complaints never costs this citizen's client
    more than one bounded fetch, however many changes queued up."""
    rows = db.execute(
        select(StatusNotification, Complaint.category)
        .join(Complaint, Complaint.id == StatusNotification.complaint_id)
        .where(StatusNotification.user_id == user.id, StatusNotification.delivered_at.is_(None))
        .order_by(StatusNotification.created_at.asc())
        .limit(limit)
    ).all()

    out = [
        NotificationOut(
            id=n.id,
            complaint_id=n.complaint_id,
            category=category,
            old_status=n.old_status,
            new_status=n.new_status,
            created_at=n.created_at,
        )
        for n, category in rows
    ]

    now = datetime.now(timezone.utc)
    for n, _ in rows:
        n.delivered_at = now
    db.commit()

    return out


@router.get("/me/stats", response_model=MyStatsOut)
def get_my_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Civic standing = real counts + the fixed rules in app/civic.py.
    One grouped query; no AI anywhere in this number."""
    rows = db.execute(
        select(Complaint.status, func.count(Complaint.id))
        .where(Complaint.user_id == user.id)
        .group_by(Complaint.status)
    ).all()
    by_status = {status: count for status, count in rows}
    total = sum(by_status.values())
    resolved = by_status.get("resolved", 0)
    in_progress = by_status.get("in_progress", 0)

    first_at = db.execute(
        select(func.min(Complaint.created_at)).where(Complaint.user_id == user.id)
    ).scalar()

    standing = compute_civic_standing(total, resolved)
    return MyStatsOut(
        complaints_total=total,
        resolved_count=resolved,
        in_progress_count=in_progress,
        first_complaint_at=first_at,
        civic_points=standing.civic_points,
        badge=standing.badge,
        next_badge=standing.next_badge,
        points_to_next=standing.points_to_next,
    )
