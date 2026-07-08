from datetime import datetime

from pydantic import BaseModel


class GovDataImportOut(BaseModel):
    id: str
    source_type: str
    source_label: str
    detected_category: str | None
    confidence: int | None
    status: str
    row_count: int
    issues: list[str] | None
    explanation: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ApiImportRequest(BaseModel):
    resource_id: str
    label: str | None = None
