from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import firebase_admin
from app.crypto import hash_for_search
from app.database import get_db
from app.models.mp_allowlist import MPAllowlistEntry
from app.models.user import User
from app.models.user_identity import UserIdentity
from app.schemas.user import AuthSyncRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync", response_model=UserOut)
def sync_user(payload: AuthSyncRequest, db: Session = Depends(get_db)):
    firebase_admin.ensure_initialized()
    try:
        decoded = firebase_auth.verify_id_token(payload.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired ID token")

    firebase_uid = decoded["uid"]
    email = decoded.get("email")
    phone_number = decoded.get("phone_number")
    display_name = decoded.get("name")
    provider = decoded.get("firebase", {}).get("sign_in_provider")

    identity = db.execute(
        select(UserIdentity).where(UserIdentity.firebase_uid == firebase_uid)
    ).scalar_one_or_none()

    if identity is not None:
        user = db.get(User, identity.user_id)
    else:
        user = None
        if email or phone_number:
            match_conditions = []
            if email:
                match_conditions.append(User.email_hash == hash_for_search(email))
            if phone_number:
                match_conditions.append(User.phone_hash == hash_for_search(phone_number))
            user = db.execute(select(User).where(or_(*match_conditions))).scalars().first()

        if user is None:
            user = User(
                firebase_uid=firebase_uid,
                email=email,
                phone_number=phone_number,
                display_name=display_name,
                provider=provider,
            )
            db.add(user)
            db.flush()

        db.add(UserIdentity(user_id=user.id, firebase_uid=firebase_uid, provider=provider))

    user.email = email or user.email
    user.phone_number = phone_number or user.phone_number
    user.display_name = display_name or user.display_name
    db.commit()
    db.refresh(user)

    is_mp = False
    if user.email or user.phone_number:
        conditions = []
        if user.email:
            conditions.append(MPAllowlistEntry.email_hash == hash_for_search(user.email))
        if user.phone_number:
            conditions.append(MPAllowlistEntry.phone_hash == hash_for_search(user.phone_number))
        is_mp = db.execute(select(MPAllowlistEntry).where(or_(*conditions))).scalars().first() is not None

    # Custom claims are baked into the ID token — the frontend can never
    # forge "mp" itself, only Firebase Admin SDK (i.e. this backend) can set
    # it. Apply to every linked sign-in method, not just the one used now,
    # so the role is consistent no matter which identity the user logs in with.
    all_uids = db.execute(
        select(UserIdentity.firebase_uid).where(UserIdentity.user_id == user.id)
    ).scalars().all()
    for uid in all_uids:
        firebase_auth.set_custom_user_claims(uid, {"role": "mp" if is_mp else None})

    return user
