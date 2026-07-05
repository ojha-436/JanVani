from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.user import ProfileUpdate, UserOut

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
