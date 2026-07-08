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
    assigned_department: str | None
    created_at: datetime
    audio_url: str | None
    photo_url: str | None
    verification_confidence: int | None
    verification_status: str | None
    verification_reasons: list[str] | None


class StatusHistoryEntry(BaseModel):
    old_status: str
    new_status: str
    changed_at: datetime


class MyComplaintOut(BaseModel):
    """A citizen's own complaint — includes the verification breakdown and
    the recorded status transitions so the UI can draw a timeline without
    guessing intermediate steps."""

    id: uuid.UUID
    text: str
    category: str | None
    location: str | None
    anonymous: bool
    status: str
    assigned_department: str | None
    created_at: datetime
    audio_url: str | None
    photo_url: str | None
    verification_confidence: int | None
    verification_status: str | None
    verification_reasons: list[str] | None
    status_history: list[StatusHistoryEntry]


class NearbyComplaintOut(BaseModel):
    """Deliberately minimal — shown to other citizens on the submit-flow
    mini-map, so no id/text/media that could identify a complainant."""

    category: str | None
    status: str
    lat: float
    lng: float
    created_at: datetime


class SuggestCategoryIn(BaseModel):
    text: str


class CategorySuggestionOut(BaseModel):
    category: str
    matched_keywords: list[str]


class SuggestCategoryOut(BaseModel):
    suggestions: list[CategorySuggestionOut]
    source: str
