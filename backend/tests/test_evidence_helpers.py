"""The gov-data corroboration bonus is the one place uploaded data can
move a score — it must only ever fire when citizens independently raised
the same category."""

from app.evidence import _gov_corroboration_bonus


def test_no_bonus_without_matching_complaints():
    bonus, reason = _gov_corroboration_bonus("education", 500, {"roads": 12}, "Testpur")
    assert bonus == 0
    assert reason is None


def test_bonus_is_fixed_15_when_complaints_corroborate():
    bonus, reason = _gov_corroboration_bonus("education", 500, {"education": 7}, "Testpur")
    assert bonus == 15
    assert "7 citizen complaints" in reason
    assert "Testpur" in reason


def test_substring_category_matching_both_directions():
    bonus, _ = _gov_corroboration_bonus("water", 10, {"water supply": 3}, "Testpur")
    assert bonus == 15
    bonus, _ = _gov_corroboration_bonus("water supply schemes", 10, {"water": 3}, "Testpur")
    assert bonus == 15


def test_gov_data_alone_never_scores():
    # However many records exist, zero complaints = zero bonus.
    bonus, _ = _gov_corroboration_bonus("education", 1_000_000, {}, "Testpur")
    assert bonus == 0
