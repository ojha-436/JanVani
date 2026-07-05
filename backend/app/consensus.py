"""Community Consensus Graph — groups nearby complaints across different
categories and asks Gemini whether they plausibly share one root cause.
Clustering itself is plain Python (grid-bucketed by rounded GPS
coordinates, ~1.1km cells); Gemini only reasons over clusters Python has
already formed, and its output is a hypothesis with a confidence score,
never a stored fact."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import gemini_client
from app.models.complaint import Complaint

GRID_PRECISION = 2  # rounding lat/lng to 2 decimals ~ 1.1km cells


@dataclass
class ConsensusCluster:
    location_hint: str
    complaint_ids: list[UUID]
    categories: list[str]
    root_cause: str | None
    confidence: int


def find_consensus_clusters(mp_constituency: str, db: Session, limit_clusters: int = 5) -> list[ConsensusCluster]:
    complaints = db.execute(
        select(Complaint).where(
            Complaint.constituency == mp_constituency,
            Complaint.lat.is_not(None),
            Complaint.lng.is_not(None),
        )
    ).scalars().all()

    buckets: dict[tuple[float, float], list[Complaint]] = {}
    for c in complaints:
        key = (round(c.lat, GRID_PRECISION), round(c.lng, GRID_PRECISION))
        buckets.setdefault(key, []).append(c)

    clusters: list[ConsensusCluster] = []
    for (lat, lng), members in buckets.items():
        categories = sorted({c.category for c in members if c.category})
        if len(members) < 2 or len(categories) < 2:
            # Single-category clusters are just duplicates — verification.py
            # already accounts for those; this is specifically for
            # cross-category correlation.
            continue

        try:
            analysis = gemini_client.find_common_cause(
                [{"category": c.category, "text": c.text} for c in members]
            )
        except Exception:
            continue  # a Gemini hiccup on one cluster shouldn't break the whole dashboard
        if not analysis.get("root_cause"):
            continue

        clusters.append(
            ConsensusCluster(
                location_hint=members[0].location or f"{lat}, {lng}",
                complaint_ids=[c.id for c in members],
                categories=categories,
                root_cause=analysis["root_cause"],
                confidence=int(analysis.get("confidence") or 0),
            )
        )
        if len(clusters) >= limit_clusters:
            break

    return sorted(clusters, key=lambda c: c.confidence, reverse=True)
