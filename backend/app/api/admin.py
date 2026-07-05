from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import firebase_admin
from app.admin_auth import verify_admin
from app.crypto import hash_for_search
from app.database import get_db
from app.models.mp_allowlist import MPAllowlistEntry
from app.models.user import User
from app.schemas.admin import (
    AddMPRequest,
    AddMPResponse,
    CreateMPAccountRequest,
    CreateMPAccountResponse,
    DeleteMPRequest,
    DeleteMPResponse,
    ListMPRequest,
    MPAllowlistEntryOut,
)
from app.schemas.user import SyncSummary

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(payload) -> None:
    if not verify_admin(payload.email, payload.password, payload.timestamp, payload.proof):
        # Deliberately vague — don't reveal which factor failed.
        raise HTTPException(status_code=401, detail="Admin authentication failed")


@router.post("/mp-allowlist", response_model=AddMPResponse)
def add_mp(payload: AddMPRequest, db: Session = Depends(get_db)):
    _require_admin(payload)

    if not payload.mp_email and not payload.mp_phone:
        raise HTTPException(status_code=400, detail="Provide mp_email or mp_phone")

    entry = MPAllowlistEntry(
        email_hash=hash_for_search(payload.mp_email) if payload.mp_email else None,
        phone_hash=hash_for_search(payload.mp_phone) if payload.mp_phone else None,
        label=payload.label,
        constituency=payload.constituency,
        district=payload.district,
    )
    db.add(entry)
    db.commit()
    return AddMPResponse(added=True)


@router.post("/mp-allowlist/list", response_model=list[MPAllowlistEntryOut])
def list_mp(payload: ListMPRequest, db: Session = Depends(get_db)):
    _require_admin(payload)

    entries = db.execute(select(MPAllowlistEntry).order_by(MPAllowlistEntry.created_at.desc())).scalars().all()
    return [
        MPAllowlistEntryOut(
            id=e.id,
            label=e.label,
            constituency=e.constituency,
            district=e.district,
            has_email=e.email_hash is not None,
            has_phone=e.phone_hash is not None,
            created_at=e.created_at,
        )
        for e in entries
    ]


@router.post("/mp-allowlist/delete", response_model=DeleteMPResponse)
def delete_mp(payload: DeleteMPRequest, db: Session = Depends(get_db)):
    _require_admin(payload)

    if not payload.mp_email and not payload.mp_phone:
        raise HTTPException(status_code=400, detail="Provide mp_email or mp_phone")

    conditions = []
    if payload.mp_email:
        conditions.append(MPAllowlistEntry.email_hash == hash_for_search(payload.mp_email))
    if payload.mp_phone:
        conditions.append(MPAllowlistEntry.phone_hash == hash_for_search(payload.mp_phone))

    entries = db.execute(select(MPAllowlistEntry).where(or_(*conditions))).scalars().all()
    for entry in entries:
        db.delete(entry)
    db.commit()
    return DeleteMPResponse(deleted=len(entries))


@router.post("/mp-account", response_model=CreateMPAccountResponse)
def create_mp_account(payload: CreateMPAccountRequest, db: Session = Depends(get_db)):
    _require_admin(payload)
    firebase_admin.ensure_initialized()

    try:
        fb_user = firebase_auth.create_user(
            email=payload.mp_email,
            password=payload.mp_password,
            email_verified=True,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    db.add(
        MPAllowlistEntry(
            email_hash=hash_for_search(payload.mp_email),
            label=payload.label,
            constituency=payload.constituency,
            district=payload.district,
        )
    )
    db.commit()

    return CreateMPAccountResponse(created=True, firebase_uid=fb_user.uid)


@router.post("/sync-firebase-users", response_model=SyncSummary)
def sync_firebase_users(db: Session = Depends(get_db)):
    firebase_admin.ensure_initialized()
    existing_by_uid = {
        u.firebase_uid: u for u in db.execute(select(User)).scalars().all()
    }

    synced = created = updated = 0
    for fb_user in firebase_auth.list_users().iterate_all():
        provider = fb_user.provider_data[0].provider_id if fb_user.provider_data else None
        user = existing_by_uid.get(fb_user.uid)
        if user is None:
            user = User(firebase_uid=fb_user.uid)
            db.add(user)
            created += 1
        else:
            updated += 1

        user.email = fb_user.email
        user.phone_number = fb_user.phone_number
        user.display_name = fb_user.display_name
        user.provider = provider
        synced += 1

    db.commit()
    return SyncSummary(synced=synced, created=created, updated=updated)
