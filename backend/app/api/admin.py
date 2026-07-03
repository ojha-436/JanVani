from fastapi import APIRouter, Depends
from firebase_admin import auth as firebase_auth
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app import firebase_admin
from app.database import get_db
from app.models.user import User
from app.schemas.user import SyncSummary

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/sync-firebase-users", response_model=SyncSummary)
def sync_firebase_users(db: Session = Depends(get_db)):
    firebase_admin.ensure_initialized()
    existing_uids = set(db.execute(select(User.firebase_uid)).scalars().all())

    synced = created = updated = 0
    for user in firebase_auth.list_users().iterate_all():
        provider = user.provider_data[0].provider_id if user.provider_data else None
        stmt = (
            insert(User)
            .values(
                firebase_uid=user.uid,
                email=user.email,
                phone_number=user.phone_number,
                display_name=user.display_name,
                provider=provider,
            )
            .on_conflict_do_update(
                index_elements=[User.firebase_uid],
                set_={
                    "email": user.email,
                    "phone_number": user.phone_number,
                    "display_name": user.display_name,
                    "provider": provider,
                },
            )
        )
        db.execute(stmt)
        synced += 1
        if user.uid in existing_uids:
            updated += 1
        else:
            created += 1

    db.commit()
    return SyncSummary(synced=synced, created=created, updated=updated)
