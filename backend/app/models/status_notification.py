import uuid

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StatusNotification(Base):
    """One row per complaint-status change the citizen hasn't seen yet — an
    outbox, not a push. Writes here are cheap inserts (see
    api/dashboard.py's update_complaint_status), so an MP updating many
    complaints at once never triggers per-row delivery work. Delivery only
    happens when the citizen's own client pulls GET /users/me/notifications,
    which marks rows delivered in that same request — see api/users.py."""

    __tablename__ = "status_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("complaints.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    old_status: Mapped[str] = mapped_column(String, nullable=False)
    new_status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    delivered_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
