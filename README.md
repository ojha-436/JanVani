# JanVaani — Citizen Voice → MP Action

> **जनवाणी** · *"the people's voice"* — a multilingual civic-tech platform.
> Citizens **speak, type, or photograph** what their area needs; an MP gets an
> AI-assisted, evidence-scored dashboard to decide what actually matters.

Built for a hackathon, now past the first working end-to-end slice: citizens
can submit complaints (voice / text / photo) and an MP can log in to a real
dashboard with AI-assisted prioritisation, evidence scoring, a hotspot map,
and a government-data upload pipeline.

> **Note on stack:** [docs/PRD.md](docs/PRD.md) and
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describe the original v2 plan
> (Firestore + BigQuery + Pub/Sub + Dialogflow). The stack that actually got
> built is simpler and is described below — a **FastAPI backend on Cloud SQL
> (Postgres)** instead of Firestore/BigQuery, and **direct Gemini calls**
> instead of a Pub/Sub-driven batch worker. Those two docs are kept for the
> original design rationale but no longer reflect what's running.

---

## What's built

### Citizen side (`/`, `/sign-in`, `/submit`)
- Phone-OTP sign-in (Firebase Auth), multi-modal complaint submission — voice,
  typed text, or photo.
- Voice complaints are transcribed automatically (Gemini audio understanding);
  photo-only complaints get an AI-generated one-line description. Both used to
  save with blank text — fixed.
- Full i18n (English / Hindi, more dictionaries scaffolded).

### MP side (`/dashboard`, `/dashboard/gov-data`, `/onboarding`, `/profile`)
- **Dashboard**: KPIs, a "Priority evidence" score, a live Google Maps hotspot
  view of complaints, a "Linked issues" panel, themes, and a recent-submissions
  list — each complaint tagged with a **Strong / Moderate / Weak evidence**
  badge.
- **Verification scoring** (`backend/app/verification.py`): every complaint's
  confidence badge is computed from independent signals only — photo-AI
  confidence, GPS presence, corroborating complaints in the same
  category/constituency, and matching government data. The AI never invents
  the score; it only explains one computed by fixed rules.
- **Community consensus** (`backend/app/consensus.py`): GPS-grid-bucketed
  complaints across *different* categories are checked by Gemini for a
  plausible shared root cause, surfaced as a hypothesis with a confidence
  percentage — never stored as fact.
- **Gov-data upload pipeline** (`backend/app/api/gov_data.py`,
  `backend/app/parsers.py`): MP uploads an Excel/CSV/PDF, or imports directly
  from a data.gov.in resource. A 3-step Gemini pipeline (schema detection →
  data-quality check → plain-language summary) proposes what the data is; a
  confidence threshold — decided in Python, not by the model — gates
  auto-commit vs. "needs review."
- **Admin / MP allowlist** (`backend/app/admin_auth.py`,
  `backend/app/api/admin.py`, `tools/admin_cli.py`): device-bound HMAC + bcrypt
  admin auth and an MP allowlist gating who can access the dashboard, managed
  via a local CLI tool.
- **User identity & profile** (`backend/app/api/users.py`,
  `src/app/onboarding`, `src/app/profile`): syncs Firebase identity to a
  Postgres `users` table with PII fields encrypted at rest
  (`backend/app/crypto.py`).

### Security hardening
- `GET /complaints` and `GET /complaints/{id}` used to have **no auth** —
  anyone could list every citizen's complaints. Now scoped to the requesting
  MP's own constituency.
- Complaint media (audio/photos) used to sit behind a **public, permanent**
  Cloud Storage URL. `storage.rules` now denies public read; the backend mints
  60-minute signed URLs on demand (`backend/app/media.py`).
- Firebase App Check wired in (soft-gated behind `ENFORCE_APP_CHECK`, default
  off until a reCAPTCHA site key is registered).

---

## Architecture (as built)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **Next.js** (App Router) | Citizen submission flow + MP dashboard, deployed on Cloud Run / Firebase Hosting. |
| Backend API | **FastAPI**, deployed as a **Firebase Function** (`backend/main.py` wraps the ASGI app via `a2wsgi`) | Also runnable standalone with `uvicorn` for local dev. |
| Database | **Cloud SQL for Postgres**, via SQLAlchemy + Alembic migrations | Connects via `cloud-sql-python-connector` in production, plain `DATABASE_URL` locally. |
| Auth | **Firebase Auth** (phone OTP for citizens, Google for MPs) + a device-bound admin auth layer for the allowlist CLI | |
| File storage | **Firebase / Cloud Storage**, signed URLs only | `storage.rules` denies direct public read. |
| AI | **Gemini** (`google-genai`), called directly from the backend — audio transcription, photo analysis, gov-data schema detection, consensus reasoning | No Vertex AI batch pipeline; calls are synchronous and best-effort (failures never block a citizen's submission). |
| Maps | **Google Maps JavaScript API**, loaded via a plain `<script>` tag (`src/components/HotspotMap.tsx`) | No npm SDK dependency. |
| App integrity | **Firebase App Check** | Optional, env-flag gated. |

---

## Repo layout

```
src/
  app/
    page.tsx                 # Landing page
    sign-in/page.tsx         # Citizen phone-OTP / MP Google sign-in
    submit/page.tsx          # Multi-modal submission: voice · text · photo
    onboarding/page.tsx       # First-time profile setup
    profile/page.tsx          # Citizen/MP profile
    dashboard/page.tsx        # MP dashboard: KPIs, map, consensus, verification badges
    gov-data/page.tsx         # MP gov-data upload + import history
  components/                 # Header, HotspotMap, Logo, LanguageSwitcher, ...
  lib/                        # firebase.ts, i18n.tsx, session.tsx, constants.ts, dashboardData.ts
  services/api.ts             # Frontend → backend API client

backend/
  app/
    api/                      # complaints, admin, auth, users, dashboard, gov_data
    models/                   # SQLAlchemy models (complaint, user, gov_data_import, mp_allowlist, ...)
    schemas/                  # Pydantic request/response schemas
    gemini_client.py          # transcribe_audio(), analyze_photo(), gov-data + consensus prompts
    verification.py           # Complaint evidence scoring
    consensus.py              # Cross-category linked-issue detection
    evidence.py                # Gov-data + complaint corroboration scoring
    parsers.py                 # Excel/CSV/PDF → rows
    media.py                   # Signed URL minting for private storage
    admin_auth.py, crypto.py   # Admin auth + field-level encryption
  alembic/versions/            # Migrations
  scripts/                     # seed_demo_data.py, import_gov_education.py
  main.py                      # Firebase Function entrypoint (wraps FastAPI via a2wsgi)

tools/admin_cli.py             # Device-bound local CLI for admin/allowlist operations
docs/PRD.md, docs/ARCHITECTURE.md   # Original v2 design docs (see stack note above)
SESSION_CHANGES.md             # Detailed changelog of the most recent working session
```

---

## Run locally

### Frontend
```bash
npm install
cp .env.example .env.local     # on Windows PowerShell: copy .env.example .env.local
npm run dev                    # http://localhost:3000
```

### Backend
```bash
cd backend
python -m venv venv && venv\Scripts\activate     # Windows; use source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # set DATABASE_URL, GOOGLE_CLOUD_PROJECT, etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The backend needs a local Postgres instance (see `backend/docker-compose.yml`
for a ready-made one) and a `serviceAccountKey.json` (Firebase service account,
**never commit this file** — it's gitignored) for Firebase Admin SDK access.

---

## Deploy

- **Frontend**: Firebase Hosting / Cloud Run (see `firebase.json`, `next.config.mjs`).
- **Backend**: deployed as a Firebase Function backed by Cloud SQL — see
  `backend/main.py` and `backend/Dockerfile` for both entrypoints (Cloud
  Function and standalone container).
- **Storage rules**: `storage.rules` must be deployed with
  `firebase deploy --only storage` any time it changes — it's what keeps
  complaint media private.

---

## Current gaps (see [SESSION_CHANGES.md](SESSION_CHANGES.md) for full detail)

- No cross-region comparison of government data yet (a district's numbers
  aren't yet benchmarked against similar districts/state averages).
- No feedback loop tracking whether an MP acted on a recommendation or whether
  the underlying problem was resolved.
- Production env vars (Maps key, App Check key, `ENFORCE_APP_CHECK`) are only
  set locally, not yet in the deployed Cloud Run/Hosting config.
- FCM push notifications discussed but not built.

---

*Built for the people, with the people.*
