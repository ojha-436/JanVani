# JanVaani — Citizen Voice → MP Action

> **जनवाणी** · *"the people's voice"* — a multilingual civic-tech platform.
> Citizens **speak, type, or photograph** what their area needs; JanVaani turns
> thousands of voices into a **ranked, evidence-backed development plan** an MP
> can act on.

Built for a 7-day hackathon. This repository currently contains the **citizen-facing
front end** — landing, sign-in, and the multi-modal submission flow — plus the
architecture and integration points for the AI analysis + MP dashboard.

---

## Why it's built this way

Four constraints drove every decision: **lightweight to load**, **secure**,
**accessible to everyone**, and **cost-effective** — deployed on **Google Cloud**.

| Layer | Technology | Rationale |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC, Turbopack) | Server-rendered HTML → fast on low-bandwidth phones; one codebase for UI + API. |
| Hosting | **Cloud Run** (Docker, `output: standalone`) | **Scales to zero** = ₹0 when idle; auto-scales for demo spikes. |
| Auth | **Firebase Auth** — Phone OTP + Google | Citizens sign in by phone number + SMS OTP (no password, no literacy barrier); MPs use Google. |
| Database | **Firestore** | Serverless, scales to zero, generous free tier; geo-hotspots via geohash. |
| Uploads | **Cloud Storage** (signed URLs) | Voice/photo go straight to a private bucket, never bloating the server. |
| Speech→Text | **Cloud Speech-to-Text (Chirp)** | Strong Indian-language coverage, pay-per-use. |
| AI (extract / classify / photo / rationale) | **Gemini on Vertex AI** | Organiser-recommended, GCP-native, cheap Flash tier. Guarded so the app runs with or without it. |

**Cost principle:** everything scales to zero; AI runs in **batches on new data
only**, never per-request. **Security:** Firebase ID tokens + Firestore rules +
server-side validation + signed URLs. **Accessibility:** voice-first, phone-OTP
login, full i18n (English / Hindi / Tamil / Marathi / Bengali), WCAG-AA contrast,
large tap targets, minimal client JS, `prefers-reduced-motion` respected.

---

## What's in here

```
src/
  app/
    layout.tsx            # fonts (Fraunces + Hanken Grotesk + Noto Devanagari) + i18n & session providers
    globals.css           # "People's Ledger" design system (design tokens, components, motion)
    page.tsx              # Landing page
    sign-in/page.tsx      # Dual-mode auth (citizen phone-OTP / MP Google)
    onboarding/page.tsx   # One-time profile capture (2nd layer after sign-in)
    profile/page.tsx      # View & edit your details; sign out
    submit/page.tsx       # Multi-modal submission (voice·text·photo) + anonymous / Aadhaar-verified choice
    dashboard/page.tsx    # MP dashboard — live ranking (falls back to sample data)
    api/submissions/route.ts  # Ingestion pipeline: Storage · STT · Gemini · Firestore
    api/recompute/route.ts    # Batch: cluster + 6-factor rank + rationale → rankings/latest
    api/rankings/route.ts     # Serves the latest ranking snapshot to the dashboard
  components/             # Logo, Header (session-aware), Footer, LanguageSwitcher
  lib/
    i18n.tsx              # Typed dictionaries + language context (EN/HI live)
    firebase.ts           # Guarded client init (runs even without keys)
    firebaseAdmin.ts      # Guarded server Admin SDK (Firestore + Storage)
    ai.ts                 # Gemini extraction/vision/rationale + Speech-to-Text (all guarded)
    ranking.ts            # The 6-factor explainable ranking engine
    publicData.ts         # Seeded Census/UDISE/NFHS/CGWB/IMD snapshot (the objectivity layer)
    profile.tsx           # Session + profile store (localStorage now → Firestore later)
    constants.ts          # Indian states / UTs
docs/                     # PRD.md · ARCHITECTURE.md (ranking engine) · DEPLOY.md (CI/CD)
firestore.rules · storage.rules · firebase.json   # Server-mediated security
.github/workflows/        # ci.yml (checks) + deploy.yml (Cloud Run via WIF)
Dockerfile                # Multi-stage → tiny Cloud Run image
```

**Citizen flow:** sign in (phone OTP / Google) → **one-time onboarding** (name,
address, constituency, PIN, state, optional Aadhaar) → **profile** (view/edit).
On the submission page a citizen chooses **Submit anonymously** or **Verify with
Aadhaar** at the top; verification surfaces the person's name + address (Aadhaar
API is stubbed for the demo — real UIDAI/DigiLocker integration comes later).

---

## Run locally

```bash
npm install
cp .env.example .env.local     # optional — the UI runs without keys (demo mode)
npm run dev                    # http://localhost:3000
```

The three pages work with **no configuration**. Sign-in and submit show a
"demo mode" notice until you add Firebase keys — the flows and UI are fully wired.

> On Windows PowerShell use `copy .env.example .env.local`.

---

## Deploy to Google Cloud (Cloud Run)

```bash
# one-time
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com speech.googleapis.com firestore.googleapis.com

# build + deploy straight from source (Cloud Build reads the Dockerfile)
gcloud run deploy janvaani \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1"
```

Cloud Run injects `PORT` (Next.js reads it automatically). Attach a service
account with `Vertex AI User`, `Cloud Speech Client`, `Storage Object Admin`,
and `Datastore User` roles so the server can reach the AI + data services via
Application Default Credentials — **no key files in the container**.

---

## Backend & data flow (implemented)

`POST /api/submissions` runs the ingestion pipeline: Cloud Storage upload →
Speech-to-Text → Gemini photo description → Gemini structured extraction →
geocode → Firestore write. `POST /api/recompute` clusters submissions, runs the
**6-factor ranking engine** (`src/lib/ranking.ts`) against a seeded public-data
snapshot, generates a Gemini "why this rank" rationale, and writes
`rankings/latest`. The MP dashboard reads it via `GET /api/rankings` and falls
back to a sample snapshot when empty. Every cloud call is **guarded** — with no
`GOOGLE_CLOUD_PROJECT` the app runs fully in demo mode. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §11 and [docs/DEPLOY.md](docs/DEPLOY.md).

## Roadmap (per the PRD)

- [x] Landing, sign-in, multi-modal submission
- [x] Speech-to-Text + Gemini extraction pipeline (per-request)
- [x] Firestore persistence + theme/hotspot aggregation (recompute job)
- [x] MP dashboard: ranked list + demand heatmap + drill-down (live data)
- [x] Explainable 6-factor ranking engine (server-side) + weight sliders
- [x] Public-dataset snapshot feeding the Gap/Population/Equity factors
- [x] CI/CD: GitHub Actions → Cloud Run (Workload Identity Federation)
- [ ] Scale path: Pub/Sub batching + BigQuery ranking + Cloud Scheduler
- [ ] Live public-data APIs; Dialogflow SMS/IVR intake

---

*Built for the people, with the people.*
