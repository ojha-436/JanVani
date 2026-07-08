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
    status: str
    assigned_department: str | None
    created_at: datetime
    has_audio: bool
    has_photo: bool
    audio_url: str | None
    photo_url: str | None
    verification_confidence: int | None
    verification_status: str | None
    verification_reasons: list[str] | None


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
    recent_has_more: bool
    map_points: list[MapPoint]


class ComplaintStatusUpdate(BaseModel):
    status: str | None = None
    assigned_department: str | None = None


class EvidenceOut(BaseModel):
    score: int
    level: str
    reasons: list[str]
    facts: dict
    explanation: str | None = None


class RankedIssueOut(BaseModel):
    category: str
    complaint_count: int
    population: float | None
    score: int
    level: str
    gov_data_summary: dict
    reasons: list[str]


class StatusCount(BaseModel):
    status: str
    count: int


class DepartmentProgress(BaseModel):
    department: str
    by_status: list[StatusCount]


class ProgressOut(BaseModel):
    by_status: list[StatusCount]
    by_status_last_30_days: list[StatusCount]
    by_department: list[DepartmentProgress]


class PeriodStats(BaseModel):
    from_date: datetime
    to_date: datetime
    total: int
    # Complaints CREATED in the window that are currently resolved — there
    # is no resolved_at column, so "resolved in this window" isn't knowable.
    resolved: int
    by_category: list[CategoryCount]


class CompareOut(BaseModel):
    current: PeriodStats
    previous: PeriodStats


class AlertOut(BaseModel):
    id: uuid.UUID
    category: str | None
    location: str | None
    verification_confidence: int | None
    verification_status: str | None
    created_at: datetime
