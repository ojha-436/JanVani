"""Per-category ranked issues for the MP dashboard — same no-guessing
principle as evidence.py (whose per-category scoring helpers this reuses):
every score traces back to a real complaint count or a corroborating
government-data record. Population comes from GovDataRecord rows the MP
has uploaded/imported with category "population" (see api/gov_data.py) —
there is no separate population dataset."""

from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.evidence import _complaint_category_counts, _gov_categories_for_district, _gov_corroboration_bonus
from app.models.complaint import Complaint
from app.models.gov_data_import import GovDataRecord
from app.models.mp_allowlist import MPAllowlistEntry


@dataclass
class RankedIssue:
    category: str
    complaint_count: int
    population: float | None
    score: int
    level: str
    gov_data_summary: dict = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)


def _population_for_district(district: str, db: Session) -> float | None:
    records = db.execute(
        select(GovDataRecord.metrics).where(
            GovDataRecord.district == district,
            func.lower(GovDataRecord.category) == "population",
        )
    ).scalars().all()
    total = 0.0
    found = False
    for metrics in records:
        for value in metrics.values():
            if isinstance(value, (int, float)):
                total += value
                found = True
    return total if found else None


def compute_ranked_issues(mp: MPAllowlistEntry, db: Session) -> list[RankedIssue]:
    if not mp.constituency:
        return []

    scope = Complaint.constituency == mp.constituency
    category_rows = db.execute(
        select(Complaint.category, func.count(Complaint.id))
        .where(scope, Complaint.category.is_not(None))
        .group_by(Complaint.category)
        .order_by(func.count(Complaint.id).desc())
    ).all()

    population = _population_for_district(mp.district, db) if mp.district else None
    gov_categories = _gov_categories_for_district(mp.district, db) if mp.district else []
    complaint_cat_counts = _complaint_category_counts(scope, db) if mp.district else {}

    issues: list[RankedIssue] = []
    for category, count in category_rows:
        score = 0
        reasons: list[str] = []
        gov_data_summary: dict = {}

        if count > 20:
            score += 30
            reasons.append(f"{count} complaints raised about {category}")
        elif count > 5:
            score += 15
            reasons.append(f"{count} complaints raised about {category}")

        for gov_cat, record_count in gov_categories:
            if not (gov_cat.lower() in category.lower() or category.lower() in gov_cat.lower()):
                continue
            gov_data_summary[gov_cat] = record_count
            bonus, reason = _gov_corroboration_bonus(gov_cat, record_count, complaint_cat_counts, mp.district)
            if bonus:
                score += bonus
                reasons.append(reason)

        score = min(score, 100)
        if score >= 70:
            level = "High"
        elif score >= 40:
            level = "Medium"
        else:
            level = "Low"

        issues.append(
            RankedIssue(
                category=category,
                complaint_count=count,
                population=population,
                gov_data_summary=gov_data_summary,
                score=score,
                level=level,
                reasons=reasons,
            )
        )

    issues.sort(key=lambda i: i.score, reverse=True)
    return issues
