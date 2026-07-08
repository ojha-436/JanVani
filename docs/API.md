# JanVaani API Reference

Base URL: the Firebase Function (`/api`) in production, `http://localhost:8000`
locally. Interactive docs at `/docs` (Swagger) when running locally.

**Auth**: every endpoint below (except `/auth/sync` and `/health`) requires
`Authorization: Bearer <Firebase idToken>`.
- *citizen* = any signed-in user (`get_current_user`)
- *MP* = allowlisted MP account (`get_current_mp`) — always scoped to the MP's
  own constituency, fail-closed when no constituency is configured.

App Check: complaint submission and gov-data uploads additionally accept an
`X-Firebase-AppCheck` header, enforced only when `ENFORCE_APP_CHECK=true`.

---

## Citizen endpoints

### `POST /complaints` — submit a complaint
Body: `text, locale, category?, location?, lat?, lng?, anonymous, audio_url?, photo_url?`
Voice-only submissions are transcribed server-side; photos are analyzed for a
description and a confidence signal. Verification scoring
(`verification.py`) runs at submission time and stores
`verification_confidence/status/reasons`.

### `GET /complaints/mine?limit&offset` — my complaints
Returns the caller's own complaints, newest first, each with signed media
URLs, the verification breakdown, `assigned_department` and
`status_history` — the recorded status transitions
(`old_status, new_status, changed_at`) used to draw the timeline.

### `GET /complaints/nearby?lat&lng&radius_km=3&limit=50` — nearby issues
Anonymized points for the submit-flow mini-map: `category, status, lat, lng,
created_at` only — deliberately no id, text or media. `radius_km` capped at
10. Bounding-box prefilter + haversine, nearest first.

### `POST /complaints/suggest-category` — category suggestion
Body: `{ "text": "..." }` (≤ 2000 chars). Returns up to 3
`{category, matched_keywords}` from the **fixed keyword table** in
`app/classify.py` (English + Hindi). `source` is always `"keywords"` — this
endpoint never calls an LLM, so identical text always returns identical
suggestions.

### `GET /users/me/stats` — civic standing
`complaints_total, resolved_count, in_progress_count, first_complaint_at,
civic_points, badge, next_badge, points_to_next`.
Rules (`app/civic.py`): points = total×10 + resolved×25; badges at fixed
thresholds 10/100/300/750 (Voice/Advocate/Champion/Guardian).

### `GET /users/me/notifications?limit=20` — status-change inbox
Pull-based outbox: undelivered status changes for the caller's complaints;
rows are marked delivered in the same request.

### `GET/PUT /users/me`, `POST /auth/sync` — profile & identity sync.

---

## MP endpoints

### `GET /dashboard/summary?recent_limit&recent_offset`
KPIs, category counts, paginated recent complaints (each incl.
`verification_reasons`), map points.

### `PATCH /dashboard/complaints/{id}/status`
Body: `{status?, assigned_department?}` — status ∈
`new|in_progress|resolved|rejected`, department from the fixed label list.
A status change queues a citizen notification (outbox insert). 404 for
complaints outside the MP's constituency.

### `GET /dashboard/compare?days=30` (7–180)
`{current, previous}` PeriodStats: `from_date, to_date, total, resolved,
by_category`. *resolved* counts complaints **created** in the window that are
currently resolved (there is no `resolved_at` column). Plain grouped counts —
nothing modeled.

### `GET /dashboard/alerts?since=<ISO>&min_confidence=70`
Up to 20 complaints created after `since` (default: last 24 h) with
`verification_confidence ≥ min_confidence`, newest first. Backs the
dashboard notification bell (60 s polling).

### `GET /dashboard/ranked-issues`
Per-category scores from `app/ranking.py` — reuses the same corroboration
helpers as `evidence.py`; every score traces to real complaint counts and
uploaded gov-data records.

### `GET /dashboard/evidence`, `GET /dashboard/progress`, `GET /dashboard/consensus`
Constituency-wide evidence score with reasons; status/department progress
counts; cross-category consensus clusters (Gemini-labeled hypothesis, never
stored as fact).

### `GET /complaints?category&status&limit&offset`, `GET /complaints/{id}`
MP drill-down list (constituency-scoped) and single complaint.

### Gov data: `POST /gov-data/upload`, `POST /gov-data/import-api`, `GET /gov-data/imports`

---

## The core rule (applies to every endpoint)

No number in any response is invented by an AI. Scores, ranks, points,
deltas and thresholds are computed by fixed Python rules
(`verification.py`, `evidence.py`, `ranking.py`, `civic.py`,
`classify.py`) and every score carries its reasons. Gemini only
transcribes, describes, and explains.
