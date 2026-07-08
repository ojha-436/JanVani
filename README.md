# JanVaani — Citizen Voice → MP Action

> **जनवाणी** · *"the people's voice"* — a multilingual civic-tech platform.
> Citizens **speak, type, or photograph** what their area needs; JanVaani turns
> thousands of voices into a **ranked, mapped, evidence-backed development plan**
> an MP can act on — and a **public board** that tracks what actually gets done.

Built for the Gen AI Academy (APAC) hackathon on the organiser's **Google Cloud**
stack. This repository is the **full end-to-end platform** — citizen intake, the AI
analysis pipeline, the explainable ranking engine, the MP dashboard, MP
provisioning, and a public accountability board.

**Live demo:** https://janvaani-1044819117404.asia-south1.run.app

| To see… | Go to |
|---|---|
| Citizen intake (voice · text · photo) | `/submit` |
| MP dashboard (ranked list · map · momentum · assistant) | `/dashboard` |
| Public accountability board | `/status` |
| Citizen "Your queries" + status | sign in → **☰** menu → *Your queries* |
| **MP admin portal** (provision MPs) | `/admin/mps` · demo pass key **`janvaani-admin-2026`** |

> The admin pass key above is the **demo default** (`MP_ADMIN_KEY` fallback in
> `src/app/api/mp/route.ts`). Set a real `MP_ADMIN_KEY` env var in production.

---

## What it does

**For citizens**
- **Multi-modal intake** — record a voice note, type, or snap a photo of an issue.
- **Voice-first & multilingual** — Speech-to-Text in 5 languages (English, Hindi,
  Tamil, Marathi, Bengali); no literacy or typing needed.
- **Anonymous or Aadhaar-verified** — submit privately, or verify to add weight and
  let the MP follow up.
- **Official constituency routing** — pick your Lok Sabha constituency (all 543,
  official ECI numbering) so your voice reaches the right MP.
- **"Your queries" dashboard** — every need you raised, with the MP's live action
  status on each (the same status shown on the public board).

**For the MP / office**
- **Explainable ranking** — a transparent **7-factor score** with a plain-language
  "why this rank" and evidence from public datasets; re-weight the factors with
  **live sliders**.
- **Momentum** — each work shows whether demand is rising, falling or steady, with a
  12-week sparkline; momentum is itself a scored factor.
- **Demand hotspot map** — Google Maps hotspots across the constituency; zoom in to
  resolve an area into individual citizen submissions.
- **Recurring-needs clustering** — thousands of raw voices collapse into a handful of
  themes, weighted by **unique citizens** (one road reported 400 times = one need).
- **Feasibility & cost agent** — one click runs a Gemini agent that returns scope, an
  indicative cost band, timeline, a rough bill of quantities and likely MPLADS
  eligibility.
- **Dashboard assistant** — a Gemini chat grounded in the constituency's live data
  that answers questions and proposes actions (confirmed before they apply).
- **Bulk import** — upload complaint registers (CSV / Excel); imported rows rank and
  map exactly like citizen voices.
- **Accountability** — set a work's status (Received → Acknowledged → Sanctioned → In
  progress → Done); it appears on the public `/status` board.

**For the admin**
- **MP provisioning** — allocate an official constituency to an MP's email, send a
  **one-time invite link**; the MP activates and gets a **constituency-scoped**
  dashboard. Bulk-provision via CSV/Excel; **deactivate** to revoke access instantly.

---

## How it works

**Citizen flow:** sign in (phone OTP / Google) → **one-time onboarding** (name,
address, constituency, PIN, state, optional Aadhaar) → **submit** (voice/text/photo,
anonymous or Aadhaar-verified, mandatory constituency) → track it under **"Your
queries"**.

**MP flow:** admin sends an invite → MP **activates** (`/mp-activate`) → dashboard is
**scoped to that constituency** → triage the ranked list, read the map, drill into
source voices, run the feasibility agent, set statuses, ask the assistant.

**Pipeline:** `POST /api/submissions` → Cloud Storage upload → **Speech-to-Text
(Chirp)** → **Gemini** photo understanding + structured extraction (category, urgency,
entities, English canonical) → area resolution → Firestore. A new submission triggers
`recompute` which clusters the voices, runs the **7-factor ranking engine** against a
seeded public-data snapshot, writes a Gemini "why this rank" rationale, and stores
`rankings/latest` — read by the dashboard in under 60 seconds.

---

## The ranking engine (the objectivity layer)

A transparent, explainable score — never a black box. Each factor is min-max
normalised and combined with **MP-adjustable weights** (`src/lib/ranking.ts`,
`src/lib/dashboardData.ts`):

| Factor | What it measures | Default weight |
|---|---|---:|
| **D** Demand | Unique citizens raising the need | 25% |
| **G** Service gap | Distance from a public-service benchmark | 20% |
| **P** Population | People served by the area | 20% |
| **E** Equity | SC/ST share, literacy, deprivation | 15% |
| **C** Corroboration | Cross-source confirmation | 5% |
| **F** Feasibility | Buildability / delivery risk | 5% |
| **M** Momentum | 30-day-vs-prior demand trend | 10% |

Public data (Census, UDISE enrolment, CGWB groundwater, IMD flood risk) is modelled as
a snapshot in `src/lib/publicData.ts` and feeds the **G / P / E** factors — it runs
in-app for the demo and is designed to scale on BigQuery. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Why it's built this way

Four constraints drove every decision: **lightweight to load**, **secure**,
**accessible to everyone**, and **cost-effective** — deployed on **Google Cloud**.

| Layer | Technology | Rationale |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC) | Server-rendered → fast on low-bandwidth phones; one codebase for UI + API. |
| Hosting | **Cloud Run** (Docker, `output: standalone`) | **Scales to zero** = ₹0 when idle; auto-scales for demo spikes. |
| AI reasoning | **Gemini 2.5 Flash on Vertex AI** | Extraction, photo understanding, ranking rationale, feasibility agent, dashboard assistant. GCP-native, cheap Flash tier. |
| Speech→Text | **Cloud Speech-to-Text (Chirp)** | Strong Indian-language coverage, pay-per-use. |
| Database | **Firestore** | Serverless, scales to zero, generous free tier. |
| Uploads | **Cloud Storage** (private) | Voice/photo go to a private bucket, served via a signed media proxy. |
| Map | **Google Maps Platform** (Maps JavaScript API) | Real hotspot tiles; falls back to a zero-key SVG map. |
| CI/CD | **GitHub Actions → Cloud Build → Cloud Run** (Workload Identity Federation) | Keyless deploys — no service-account JSON in the repo. |
| Auth / session | Phone-OTP (citizen) · invite-link + activation (MP) | Client session store for the demo; designed to swap to **Firebase Auth + custom claims** (`src/lib/profile.tsx` is the single seam). |

**Cost principle:** everything scales to zero; ranking recomputes on new data (or on a
Cloud Scheduler cadence), never per-request. **Graceful degradation:** every cloud
call is **guarded** — with no `GOOGLE_CLOUD_PROJECT` the app runs fully in **demo
mode** (keeps the citizen's own words, shows sample data) and never crashes.
**Accessibility:** voice-first, phone-OTP login, i18n, WCAG-AA contrast, large tap
targets, minimal client JS, `prefers-reduced-motion` respected.

---

## Repository layout

```
src/
  app/
    layout.tsx              # fonts (Fraunces + Hanken Grotesk + Noto Devanagari) + i18n & session providers
    globals.css             # design system (tokens, components, motion)
    page.tsx                # Landing page
    sign-in/                # Dual-mode auth (citizen phone-OTP / MP)
    onboarding/             # One-time profile capture
    profile/                # View & edit details; sign out
    submit/                 # Multi-modal submission + constituency + anonymous/Aadhaar choice
    dashboard/              # MP dashboard — ranking · map · momentum · drill-down · assistant · bulk (scoped)
    status/                 # Public accountability board ("Action taken")
    mp-activate/            # MP invite-link activation
    admin/mps/              # Admin console — provision · bulk-provision · deactivate MPs
    api/
      submissions/          # Ingestion (Storage · STT · Gemini · Firestore) + constituency-scoped feed
      recompute/            # Cluster + 7-factor rank + Gemini rationale → rankings/latest
      rankings/             # Serves the latest ranking snapshot
      status/               # Public status board data + set-status
      estimate/             # Feasibility & cost agent (Gemini)
      assistant/            # Grounded dashboard assistant (Gemini)
      bulk/                 # Citizen complaint bulk import (CSV/Excel) + template
      media/[id]/           # Signed proxy for private voice/photo media
      mp/                   # MP provisioning — create · list · deactivate/reactivate
      mp/resolve/           # Resolve MP by invite token / email + activate
      mp/bulk/              # Bulk MP provisioning + CSV/Excel template
  components/               # Header, Footer, Logo, LanguageSwitcher, AccountMenu, AssistantChat,
                            # BulkUpload, DemandMap, GoogleDemandMap, Momentum, SubmissionDetail
  lib/
    i18n.tsx                # Typed dictionaries + language context
    firebase.ts             # Guarded client init      firebaseAdmin.ts # Guarded server Admin SDK
    ai.ts                   # Gemini (extract/photo/rationale/assistant/estimate) + Speech-to-Text — all guarded
    ranking.ts              # 7-factor explainable ranking engine
    recompute.ts            # Shared cluster + rank + store helper
    publicData.ts           # Seeded Census/UDISE/CGWB/IMD snapshot (objectivity layer)
    dashboardData.ts        # Factor keys, default weights, status metadata, dashboard types
    estimate.ts             # Feasibility/cost estimate types + fallback + INR formatting
    mp.ts                   # MP allocation model + invite links
    queries.ts              # Per-device record of a citizen's raised queries
    profile.tsx             # Session + profile store (localStorage now → Firebase Auth later)
    constituencies.ts       # Official 543 Lok Sabha constituencies (ECI numbering)
    sampleData.ts constants.ts
docs/                       # PRD.md · ARCHITECTURE.md (ranking engine) · DEPLOY.md (CI/CD)
firestore.rules · storage.rules · firebase.json   # Server-mediated, deny-all client security
.github/workflows/          # ci.yml (lint·typecheck·build) + deploy.yml (Cloud Run via WIF)
Dockerfile                  # Multi-stage → tiny Cloud Run image
jest.config.js · src/lib/__tests__/                # Unit tests (ranking, etc.)
```

---

## Run locally

```bash
npm install
cp .env.example .env.local     # optional — the UI runs without keys (demo mode)
npm run dev                    # http://localhost:3000
```

Everything works with **no configuration** — sign-in and submit show a "demo mode"
notice until you add Firebase + Google Cloud keys; the flows and UI are fully wired.

```bash
npm run typecheck              # tsc --noEmit
npm run lint                   # next lint
npm test                       # jest unit tests
```

> On Windows PowerShell use `copy .env.example .env.local`.

---

## Deploy to Google Cloud (Cloud Run)

```bash
# one-time
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com \
  speech.googleapis.com firestore.googleapis.com storage.googleapis.com

# build + deploy straight from source (Cloud Build reads the Dockerfile)
gcloud run deploy janvaani \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,VERTEX_GEMINI_MODEL=gemini-2.5-flash,UPLOADS_BUCKET=janvaani-uploads"
```

Attach a service account with **Vertex AI User**, **Cloud Speech Client**, **Storage
Object Admin**, and **Datastore User** so the server reaches the AI + data services via
Application Default Credentials — **no key files in the container**. CI/CD, IAM,
Workload Identity Federation, the optional **Google Maps** key and the Cloud Scheduler
recompute job are documented in [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Security & privacy

- **Deny-all client rules** (`firestore.rules`, `storage.rules`) — every read/write is
  server-mediated through the API routes with server-side validation.
- **Private media** — voice/photo live in a private bucket, streamed through the signed
  `/api/media/[id]` proxy; never public URLs.
- **Anonymity by design** — anonymous submissions carry no identity; the citizen key is
  salted (`SUBMISSION_SALT`).
- **Scoped MP access** — provisioning binds an MP to one constituency server-side;
  deactivation revokes access. *(Known limit: the session store is client-side for the
  demo — Firebase Auth + custom claims is the documented production hardening.)*

---

## Roadmap (per the PRD)

- [x] Landing, sign-in, multi-modal submission (voice · text · photo)
- [x] Speech-to-Text + Gemini extraction/vision pipeline
- [x] Firestore persistence + clustering + hotspot aggregation
- [x] MP dashboard: ranked list + Google Maps heatmap + drill-down (live data)
- [x] Explainable **7-factor** ranking engine + live weight sliders + **Momentum**
- [x] Public-dataset snapshot feeding the Gap / Population / Equity factors
- [x] Feasibility & cost agent · grounded dashboard assistant (Gemini)
- [x] Accountability status board · citizen "Your queries" tracking
- [x] Bulk complaint import (CSV/Excel) · official Lok Sabha constituency routing
- [x] MP provisioning: invite → activate → scoped dashboard · bulk · deactivate
- [x] CI/CD: GitHub Actions → Cloud Run (Workload Identity Federation)
- [ ] Scale path: Pub/Sub batching + BigQuery ranking + Cloud Scheduler
- [ ] Firebase Auth + custom claims (tamper-proof MP scoping)
- [ ] Live public-data APIs; Dialogflow SMS / WhatsApp / IVR intake; Aadhaar/OTP verify

---

*Built for the people, with the people.*
