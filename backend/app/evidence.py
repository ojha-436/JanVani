"""Rule-based evidence scoring — no AI, no guessing. Every point on the
score traces back to a specific number from our own complaint data or an
imported government dataset. Gemini (see gemini_client.py) is only ever
used afterward, to phrase this already-computed evidence in plain
language for the MP — it never decides the score itself."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.complaint import Complaint
from app.models.gov_data_import import GovDataRecord
from app.models.gov_education_stat import GovEducationStat
from app.models.mp_allowlist import MPAllowlistEntry


@dataclass
class EvidenceResult:
    score: int
    level: str
    reasons: list[str] = field(default_factory=list)
    facts: dict = field(default_factory=dict)


def compute_evidence(mp: MPAllowlistEntry, db: Session) -> EvidenceResult:
    score = 0
    reasons: list[str] = []
    facts: dict = {}

    if not mp.constituency:
        return EvidenceResult(score=0, level="Low", reasons=["No constituency configured for this MP"], facts={})

    scope = Complaint.constituency == mp.constituency
    total_complaints = db.execute(select(func.count(Complaint.id)).where(scope)).scalar_one()
    facts["total_complaints"] = total_complaints

    # Growth: complaints in the last 30 days vs the 30 days before that.
    now = datetime.now(timezone.utc)
    last_30 = db.execute(
        select(func.count(Complaint.id)).where(scope, Complaint.created_at >= now - timedelta(days=30))
    ).scalar_one()
    prev_30 = db.execute(
        select(func.count(Complaint.id)).where(
            scope,
            Complaint.created_at >= now - timedelta(days=60),
            Complaint.created_at < now - timedelta(days=30),
        )
    ).scalar_one()
    growth_pct = ((last_30 - prev_30) / prev_30 * 100) if prev_30 > 0 else (100.0 if last_30 > 0 else 0.0)
    facts["complaints_last_30_days"] = last_30
    facts["complaints_prev_30_days"] = prev_30
    facts["growth_pct"] = round(growth_pct, 1)

    if total_complaints > 20:
        score += 30
        reasons.append(f"{total_complaints} complaints raised in this constituency")
    elif total_complaints > 5:
        score += 15
        reasons.append(f"{total_complaints} complaints raised in this constituency")

    if growth_pct > 50 and prev_30 > 0:
        score += 20
        reasons.append(f"Complaint volume up {round(growth_pct)}% over the last 30 days")

    # Government education data for the MP's district, if configured.
    edu = db.get(GovEducationStat, mp.district) if mp.district else None
    if edu:
        facts["education"] = {
            "district": edu.district,
            "schools_total": edu.schools_total,
            "students_total": edu.students_total,
            "pass_pct_class_x": edu.pass_pct_class_x,
            "pass_pct_class_xii": edu.pass_pct_class_xii,
        }
        if edu.students_total and edu.schools_total:
            students_per_school = edu.students_total / edu.schools_total
            facts["education"]["students_per_school"] = round(students_per_school, 1)
            if students_per_school > 2000:
                score += 25
                reasons.append(
                    f"{round(students_per_school)} students per school in {edu.district} district "
                    "(high load per school)"
                )
        if edu.pass_pct_class_x is not None and edu.pass_pct_class_x < 90:
            score += 15
            reasons.append(f"Class X pass rate is {edu.pass_pct_class_x}% in {edu.district} district")

    # Government data uploaded/imported by the MP (see api/gov_data.py) for
    # categories beyond education — cross-checked against the constituency's
    # own complaint categories for the same district. We don't invent
    # thresholds for arbitrary uploaded metrics; a bonus only applies when
    # citizen complaints independently corroborate the same category.
    if mp.district:
        complaint_cat_counts = _complaint_category_counts(scope, db)
        gov_categories = _gov_categories_for_district(mp.district, db)
        if gov_categories:
            facts["uploaded_gov_data"] = {cat: n for cat, n in gov_categories}

        for gov_cat, record_count in gov_categories:
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

    return EvidenceResult(score=score, level=level, reasons=reasons, facts=facts)


def _complaint_category_counts(scope, db: Session) -> dict[str, int]:
    return {
        (cat or "").lower(): count
        for cat, count in db.execute(
            select(Complaint.category, func.count(Complaint.id))
            .where(scope, Complaint.category.is_not(None))
            .group_by(Complaint.category)
        ).all()
    }


def _gov_categories_for_district(district: str, db: Session) -> list[tuple[str, int]]:
    return db.execute(
        select(GovDataRecord.category, func.count(GovDataRecord.id))
        .where(GovDataRecord.district == district)
        .group_by(GovDataRecord.category)
    ).all()


def _gov_corroboration_bonus(
    gov_cat: str, record_count: int, complaint_cat_counts: dict[str, int], district: str
) -> tuple[int, str | None]:
    """Shared by compute_evidence (constituency-wide score) and
    ranking.compute_ranked_issues (per-category score) — a bonus only ever
    applies when citizen complaints independently corroborate the same
    government-data category, never from the gov data alone."""
    matched_complaints = next(
        (n for cat, n in complaint_cat_counts.items() if gov_cat.lower() in cat or cat in gov_cat.lower()),
        0,
    )
    if matched_complaints == 0:
        return 0, None
    return 15, (
        f"Uploaded government data ({record_count} {gov_cat} records) corroborates "
        f"{matched_complaints} citizen complaints in {district} district"
    )
