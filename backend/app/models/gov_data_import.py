import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GovDataImport(Base):
    """One row per MP-initiated government-data ingest (file upload or
    data.gov.in API pull). This is the audit trail: who uploaded what, what
    AI decided it was, and whether it was trusted enough to commit. The
    parsed rows themselves live in GovDataRecord — this table never holds
    raw data, only the metadata of the import."""

    __tablename__ = "gov_data_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mp_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("mp_allowlist.id"), nullable=True)
    source_type: Mapped[str] = mapped_column(String, nullable=False)  # "file" | "api"
    source_label: Mapped[str] = mapped_column(String, nullable=False)  # filename or api resource id
    detected_category: Mapped[str | None] = mapped_column(String, nullable=True)
    field_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")  # pending|committed|needs_review|failed
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    issues: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GovDataRecord(Base):
    """Category-agnostic government data row, normalized by AI schema
    mapping into {district, category, metrics}. This is what lets us accept
    education, health, roads, water, etc. data through one upload pipeline
    without a new table per category."""

    __tablename__ = "gov_data_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    import_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gov_data_imports.id"), nullable=False)
    district: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
