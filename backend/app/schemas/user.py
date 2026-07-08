import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field, field_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firebase_uid: str
    email: str | None
    phone_number: str | None
    display_name: str | None
    provider: str | None
    created_at: datetime

    first_name: str | None
    last_name: str | None
    address: str | None
    constituency: str | None
    pincode: str | None
    state: str | None
    aadhaar_last4: str | None

    @computed_field
    @property
    def is_onboarded(self) -> bool:
        return bool((self.first_name or "").strip() and (self.state or "").strip())


class ProfileUpdate(BaseModel):
    first_name: str
    last_name: str = ""
    address: str = ""
    constituency: str = ""
    pincode: str = ""
    state: str
    aadhaar: str | None = None

    @field_validator("aadhaar")
    @classmethod
    def validate_aadhaar(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        digits = re.sub(r"\D", "", v)
        if len(digits) != 12:
            raise ValueError("Aadhaar number must be 12 digits")
        return digits


class SyncSummary(BaseModel):
    synced: int
    created: int
    updated: int


class AuthSyncRequest(BaseModel):
    id_token: str


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    complaint_id: uuid.UUID
    category: str | None
    old_status: str
    new_status: str
    created_at: datetime


class MyStatsOut(BaseModel):
    """Civic standing for the signed-in citizen. Numbers come from real
    complaint counts + the fixed rules in app/civic.py — never from AI."""

    complaints_total: int
    resolved_count: int
    in_progress_count: int
    first_complaint_at: datetime | None
    civic_points: int
    badge: str
    next_badge: str | None
    points_to_next: int | None
