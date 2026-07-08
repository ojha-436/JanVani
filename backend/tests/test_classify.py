"""suggest_categories is the whole 'AI' of category suggestion — it must
be deterministic, bilingual, and never invent a category."""

from app.classify import KEYWORD_MAP, suggest_categories

CANONICAL = {
    "Roads", "Water Supply", "Education", "Healthcare",
    "Electricity", "Sanitation", "Public Safety",
}


def test_keyword_map_covers_exactly_the_canonical_categories():
    assert set(KEYWORD_MAP) == CANONICAL


def test_english_road_complaint():
    result = suggest_categories("The road has potholes and the streetlight is broken")
    assert result[0][0] == "Roads"
    assert "pothole" in result[0][1]


def test_hindi_water_complaint():
    result = suggest_categories("हमारे इलाके में पानी की पाइपलाइन टूटी है")
    assert result[0][0] == "Water Supply"


def test_mixed_language_matches_both():
    cats = [c for c, _ in suggest_categories("school के पास कचरा जमा है")]
    assert "Education" in cats
    assert "Sanitation" in cats


def test_whole_word_matching_for_latin_keywords():
    # "tap" must not fire inside "tape recorder shop opened".
    cats = [c for c, _ in suggest_categories("a tape recorder shop opened")]
    assert "Water Supply" not in cats


def test_empty_and_irrelevant_text():
    assert suggest_categories("") == []
    assert suggest_categories("completely unrelated musings about weather") == []


def test_deterministic_and_capped():
    text = "road water school hospital bijli garbage police"
    first = suggest_categories(text)
    second = suggest_categories(text)
    assert first == second
    assert len(first) <= 3


def test_ties_break_alphabetically():
    # One keyword hit each -> equal score -> alphabetical order.
    result = suggest_categories("garbage near the school")
    assert [c for c, _ in result] == ["Education", "Sanitation"]


def test_never_returns_unknown_category():
    for text in ("road", "पानी", "school garbage police hospital"):
        for cat, _ in suggest_categories(text):
            assert cat in CANONICAL
