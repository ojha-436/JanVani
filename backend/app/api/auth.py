from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app import firebase_admin
from app.database import get_db
from app.models.user import User
from app.schemas.user import AuthSyncRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync", response_model=UserOut)
def sync_user(payload: AuthSyncRequest, db: Session = Depends(get_db)):
    firebase_admin.ensure_initialized()
    try:
        decoded = firebase_auth.verify_id_token(payload.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired ID token")

    provider = decoded.get("firebase", {}).get("sign_in_provider")
    stmt = (
        insert(User)
        .values(
            firebase_uid=decoded["uid"],
            email=decoded.get("email"),
            phone_number=decoded.get("phone_number"),
            display_name=decoded.get("name"),
            provider=provider,
        )
        .on_conflict_do_update(
            index_elements=[User.firebase_uid],
            set_={
                "email": decoded.get("email"),
                "phone_number": decoded.get("phone_number"),
                "display_name": decoded.get("name"),
                "provider": provider,
            },
        )
        .returning(User)
    )
    user = db.execute(stmt).scalar_one()
    db.commit()
    return user
