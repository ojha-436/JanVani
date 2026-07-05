import uuid
from datetime import datetime

from pydantic import BaseModel


class CategoryCount(BaseModel):
    category: str
    count: int


class RecentComplaint(BaseModel):
    id: uuid.UUID
    text: str
    category: str | None
    location: str | None
    anonymous: bool
    created_at: datetime
    has_audio: bool
    has_photo: bool
    verification_confidence: int | None
    verification_status: str | None


class MapPoint(BaseModel):
    id: uuid.UUID
    lat: float
    lng: float
    category: str | None
    location: str | None


class ConsensusClusterOut(BaseModel):
    location_hint: str
    complaint_count: int
    categories: list[str]
    root_cause: str | None
    confidence: int


class DashboardSummary(BaseModel):
    total_complaints: int
    distinct_locations: int
    by_category: list[CategoryCount]
    recent: list[RecentComplaint]
    map_points: list[MapPoint]


class EvidenceOut(BaseModel):
    score: int
    level: str
    reasons: list[str]
    facts: dict
    explanation: str | None = None
