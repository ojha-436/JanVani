"""Civic standing must follow the published fixed rules exactly —
these tests ARE the published thresholds."""

from app.civic import BADGE_LADDER, POINTS_PER_COMPLAINT, POINTS_PER_RESOLVED, compute_civic_standing


def test_points_formula():
    s = compute_civic_standing(total=3, resolved=2)
    assert s.civic_points == 3 * POINTS_PER_COMPLAINT + 2 * POINTS_PER_RESOLVED == 80


def test_zero_activity():
    s = compute_civic_standing(0, 0)
    assert s.civic_points == 0
    assert s.badge == "New voice"
    assert s.next_badge == "Voice"
    assert s.points_to_next == 10


def test_every_threshold_boundary_awards_its_badge():
    for threshold, name in BADGE_LADDER:
        # Construct exactly `threshold` points from complaints alone.
        assert threshold % POINTS_PER_COMPLAINT == 0, "ladder must be reachable"
        s = compute_civic_standing(threshold // POINTS_PER_COMPLAINT, 0)
        assert s.civic_points == threshold
        assert s.badge == name


def test_one_point_below_threshold_keeps_previous_badge():
    s = compute_civic_standing(9, 0)  # 90 pts, Advocate needs 100
    assert s.badge == "Voice"
    assert s.next_badge == "Advocate"
    assert s.points_to_next == 10


def test_top_badge_has_no_next():
    s = compute_civic_standing(100, 0)  # 1000 pts
    assert s.badge == "Guardian"
    assert s.next_badge is None
    assert s.points_to_next is None


def test_resolved_complaints_count_extra():
    unresolved = compute_civic_standing(10, 0)
    resolved = compute_civic_standing(10, 10)
    assert resolved.civic_points - unresolved.civic_points == 10 * POINTS_PER_RESOLVED
