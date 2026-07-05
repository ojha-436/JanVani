from fastapi import Depends, HTTPException, Request
from firebase_admin import auth as firebase_auth
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import firebase_admin
from app.crypto import hash_for_search
from app.database import get_db
from app.models.mp_allowlist import MPAllowlistEntry
from app.models.user import User
from app.models.user_identity import UserIdentity


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    firebase_admin.ensure_initialized()
    try:
        decoded = firebase_auth.verify_id_token(auth_header.removeprefix("Bearer "))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired ID token")

    identity = db.execute(
        select(UserIdentity).where(UserIdentity.firebase_uid == decoded["uid"])
    ).scalar_one_or_none()
    if identity is None:
        raise HTTPException(status_code=404, detail="User not synced yet — call /auth/sync first")

    user = db.get(User, identity.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_current_mp(request: Request, db: Session = Depends(get_db)) -> MPAllowlistEntry:
    """Verifies the caller's ID token carries the server-granted 'mp' custom
    claim — never trust a client-side role toggle for this — and returns
    their allowlist entry (which carries their constituency)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    firebase_admin.ensure_initialized()
    try:
        decoded = firebase_auth.verify_id_token(auth_header.removeprefix("Bearer "))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired ID token")

    if decoded.get("role") != "mp":
        raise HTTPException(status_code=403, detail="MP access required")

    email = decoded.get("email")
    phone_number = decoded.get("phone_number")
    conditions = []
    if email:
        conditions.append(MPAllowlistEntry.email_hash == hash_for_search(email))
    if phone_number:
        conditions.append(MPAllowlistEntry.phone_hash == hash_for_search(phone_number))

    entry = db.execute(select(MPAllowlistEntry).where(or_(*conditions))).scalars().first() if conditions else None
    if entry is None:
        raise HTTPException(status_code=403, detail="MP allowlist entry not found")
    return entry
