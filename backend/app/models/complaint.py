import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    locale: Mapped[str] = mapped_column(String, nullable=False, default="en")
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="new")
    # A plain tracking tag the MP sets from the dashboard (see api/dashboard.py)
    # — there is no department login/account system yet, so this is just a
    # label from a fixed list, not a foreign key.
    assigned_department: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # URLs of files already uploaded to Firebase Storage by the client —
    # the backend never receives the raw audio/photo bytes.
    audio_url: Mapped[str | None] = mapped_column(String, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Set server-side from the submitter's account — never trust a
    # client-supplied value. user_id is kept even for "anonymous"
    # complaints (for internal dedup/moderation) but is never exposed via
    # the MP-facing API; constituency is a snapshot at submission time so
    # historical complaints stay correctly attributed if a citizen's
    # profile changes later.
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    constituency: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # Computed once at submission time by app/verification.py — a rule-based
    # score from independent signals (photo AI analysis, GPS, corroborating
    # complaints, MP-uploaded government data). Never re-guessed by AI later;
    # see verification.py for why each point was awarded.
    verification_confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verification_status: Mapped[str | None] = mapped_column(String, nullable=True)  # Strong|Moderate|Weak
    verification_reasons: Mapped[list | None] = mapped_column(JSONB, nullable=True)
