"""Civic standing (gamification) — fixed, readable rules only.

Points and badges are computed from real complaint counts with the
thresholds below; there is no AI, no weighting tweaks, no hidden state.
A citizen (or a reviewer) can recompute their own number by hand, which
is the same transparency bar evidence.py holds itself to.
"""

from dataclasses import dataclass

POINTS_PER_COMPLAINT = 10
POINTS_PER_RESOLVED = 25  # a resolved issue proves the report mattered

# (minimum points, badge name) — ascending.
BADGE_LADDER: list[tuple[int, str]] = [
    (10, "Voice"),
    (100, "Advocate"),
    (300, "Champion"),
    (750, "Guardian"),
]


@dataclass
class CivicStanding:
    civic_points: int
    badge: str
    next_badge: str | None
    points_to_next: int | None


def compute_civic_standing(total: int, resolved: int) -> CivicStanding:
    points = total * POINTS_PER_COMPLAINT + resolved * POINTS_PER_RESOLVED

    badge = "New voice"
    next_badge: str | None = BADGE_LADDER[0][1]
    points_to_next: int | None = BADGE_LADDER[0][0] - points

    for threshold, name in BADGE_LADDER:
        if points >= threshold:
            badge = name
        else:
            next_badge = name
            points_to_next = threshold - points
            break
    else:
        next_badge = None
        points_to_next = None

    return CivicStanding(
        civic_points=points,
        badge=badge,
        next_badge=next_badge,
        points_to_next=points_to_next,
    )
