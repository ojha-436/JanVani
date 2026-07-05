import uuid

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MPAllowlistEntry(Base):
    """A citizen whose email or phone matches an entry here is granted the
    'mp' role (Firebase custom claim) the next time they sign in. Entries
    are only ever added via the device-bound admin CLI — never through any
    public-facing endpoint."""

    __tablename__ = "mp_allowlist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_hash: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    phone_hash: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    # The constituency this MP represents — the dashboard only ever shows
    # this MP complaints whose constituency matches.
    constituency: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    # Delhi administrative district (e.g. "North East-I") matching the
    # naming used in government datasets — used to join evidence data,
    # since district boundaries don't map 1:1 to constituencies.
    district: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
