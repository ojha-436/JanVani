"""Endpoint validation behavior — the contracts the frontend relies on.
No database: every asserted response is produced before any query runs
(or by the keyword classifier, which is pure Python)."""


class TestSuggestCategory:
    def test_returns_deterministic_keyword_suggestions(self, client):
        res = client.post("/complaints/suggest-category", json={"text": "road full of potholes"})
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "keywords"
        assert body["suggestions"][0]["category"] == "Roads"
        assert "pothole" in body["suggestions"][0]["matched_keywords"]

    def test_hindi_text(self, client):
        res = client.post("/complaints/suggest-category", json={"text": "बिजली का ट्रांसफार्मर खराब है"})
        assert res.status_code == 200
        assert res.json()["suggestions"][0]["category"] == "Electricity"

    def test_empty_text_gives_no_suggestions(self, client):
        res = client.post("/complaints/suggest-category", json={"text": "   "})
        assert res.status_code == 200
        assert res.json()["suggestions"] == []

    def test_oversized_text_rejected(self, client):
        res = client.post("/complaints/suggest-category", json={"text": "x" * 2001})
        assert res.status_code == 422

    def test_requires_auth(self, anon_client):
        res = anon_client.post("/complaints/suggest-category", json={"text": "road"})
        assert res.status_code in (401, 403)


class TestStatusUpdateValidation:
    def test_rejects_unknown_status(self, client):
        res = client.patch(
            "/dashboard/complaints/00000000-0000-0000-0000-000000000000/status",
            json={"status": "escalated-to-mars"},
        )
        assert res.status_code == 422
        assert "status must be one of" in res.json()["detail"]

    def test_rejects_unknown_department(self, client):
        res = client.patch(
            "/dashboard/complaints/00000000-0000-0000-0000-000000000000/status",
            json={"assigned_department": "Ministry of Magic"},
        )
        assert res.status_code == 422

    def test_rejects_empty_update(self, client):
        res = client.patch(
            "/dashboard/complaints/00000000-0000-0000-0000-000000000000/status",
            json={},
        )
        assert res.status_code == 422

    def test_rejects_malformed_uuid(self, client):
        res = client.patch("/dashboard/complaints/not-a-uuid/status", json={"status": "resolved"})
        assert res.status_code == 422


class TestCompareValidation:
    def test_days_below_minimum_rejected(self, client):
        assert client.get("/dashboard/compare?days=6").status_code == 422

    def test_days_above_maximum_rejected(self, client):
        assert client.get("/dashboard/compare?days=181").status_code == 422


class TestAlertsValidation:
    def test_confidence_out_of_range_rejected(self, client):
        assert client.get("/dashboard/alerts?min_confidence=150").status_code == 422

    def test_bad_since_timestamp_rejected(self, client):
        assert client.get("/dashboard/alerts?since=not-a-date").status_code == 422


class TestNearbyValidation:
    def test_latitude_out_of_range_rejected(self, client):
        assert client.get("/complaints/nearby?lat=123&lng=77").status_code == 422

    def test_radius_above_cap_rejected(self, client):
        assert client.get("/complaints/nearby?lat=28.6&lng=77.2&radius_km=50").status_code == 422

    def test_missing_coordinates_rejected(self, client):
        assert client.get("/complaints/nearby").status_code == 422


class TestRouteOrdering:
    def test_mine_is_not_swallowed_by_uuid_route(self, client):
        """GET /complaints/mine must hit the literal route, not 422 as a
        malformed complaint_id — guards the declaration order."""
        client.db_mock.execute.return_value.scalars.return_value.all.return_value = []
        res = client.get("/complaints/mine")
        assert res.status_code == 200
        assert res.json() == []
