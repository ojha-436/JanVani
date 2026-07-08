from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GovEducationStat(Base):
    """District-level Delhi education statistics, imported from data.gov.in
    (source: delhi.data.gov.in, 'District wise Number of Schools, Student
    Enrollment and Pass Percentage for Class X and XII in Delhi'). Refreshed
    periodically via a backend import script — never fetched live per
    request."""

    __tablename__ = "gov_education_stats"

    district: Mapped[str] = mapped_column(String, primary_key=True)
    schools_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    students_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pass_pct_class_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    pass_pct_class_xii: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="data.gov.in")
    imported_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
