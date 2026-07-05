import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ComplaintCreate(BaseModel):
    text: str
    locale: str = "en"
    category: str | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    anonymous: bool = False
    audio_url: str | None = None
    photo_url: str | None = None


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: str
    locale: str
    category: str | None
    location: str | None
    lat: float | None
    lng: float | None
    anonymous: bool
    status: str
    created_at: datetime
    audio_url: str | None
    photo_url: str | None
    verification_confidence: int | None
    verification_status: str | None
    verification_reasons: list[str] | None
