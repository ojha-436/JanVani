import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firebase_uid: str
    email: str | None
    phone_number: str | None
    display_name: str | None
    provider: str | None
    created_at: datetime


class SyncSummary(BaseModel):
    synced: int
    created: int
    updated: int


class AuthSyncRequest(BaseModel):
    id_token: str
