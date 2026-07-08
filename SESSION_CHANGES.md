  JanVaani — Session Changes Summary

**Generated:** 2026-07-05 · **Updated:** 2026-07-08

---

## 2026-07-08 — DEPLOYED TO PRODUCTION ✅

Both halves live and verified (22/22 Playwright checks passed against
https://vipasana-499205.web.app; all new API routes respond on
https://asia-south1-vipasana-499205.cloudfunctions.net/api).

- **Migrations applied to live Cloud SQL** (`a1b2c3d4e5f7` + `b2c3d4e5f6a8`
  → head) via **Cloud SQL Auth Proxy** with a `gcloud auth print-access-token`
  token — no authorized-networks/firewall change was made (the proxy is the
  clean path past the rotating-dev-IP problem; reuse it for future
  migrations: `cloud-sql-proxy --token "$(gcloud auth print-access-token)"
  --port 5433 vipasana-499205:asia-south1:vipasana-499205-instance`, then
  alembic with DATABASE_URL host swapped to 127.0.0.1:5433).
- **Backend deployed** (`firebase deploy --only functions`). Incident: the
  default 256Mi function memory OOM-crash-looped on startup (~260-270Mi);
  hotfixed live via `gcloud run services update api --memory=512Mi` and
  pinned in code (`backend/main.py`, `memory=512`).
- **Frontend deployed** (`firebase deploy --only hosting`).
- Verification found and fixed two real bugs pre-deploy: the
  `[data-theme=dark]` token block was stripped by LightningCSS (tokens are
  now `light-dark()` pairs in `@theme` — the only pattern that survives the
  build), and ThemeToggle's first click was a no-op from the "system" state.
- Known cosmetic: `/favicon.ico` 404s in the browser console —
  `src/app/icon.svg` added (ships with the next hosting deploy).
- NOT yet done: git push to origin (all work is in local commits only),
  App Check (still deferred, no reCAPTCHA key), Token Creator grant
  (deferred — prod media links still null), demo-data cleanup (deferred).

## 2026-07-08 session — full build-out (committed in 4 commits)

Everything in this block IS committed. Verified: `next build` green
(11 routes), `tsc --noEmit` clean, backend pytest 36/36, vitest 12/12.

**Design/system**
- Dark mode across the whole app: `[data-theme="dark"]` remaps every design
  token in `globals.css` (previously-hardcoded card/field/header surfaces
  tokenized); no-flash inline script in `layout.tsx`; theme provider
  (`src/lib/theme.tsx`) light/dark/system + toggle in both headers.
- Shared UI kit `src/components/ui/`: StatusBadge, EvidenceMeter,
  StatusTimeline, Stat, Tabs, Modal, Accordion, EmptyState. Print CSS
  (`.no-print`/`.print-only`) — `window.print()` is the report export.

**New citizen features**
- `/my-complaints` (status timeline from recorded transitions + evidence
  meter + reasons + department + media), `/guide` (bilingual guide + FAQ),
  `/about` (published scoring rulebook).
- Submit flow: deterministic category-suggestion chips
  (`backend/app/classify.py`, en+hi keywords, `source: "keywords"` always),
  nearby-issues MiniMap (`GET /complaints/nearby`, anonymized), draft
  auto-save/restore (localStorage).
- Civic standing card on profile (`backend/app/civic.py`: total×10 +
  resolved×25; badges 10/100/300/750).

**New MP features**
- Notification bell (60 s polling of `GET /dashboard/alerts`, unseen count
  in localStorage), compare mode (`GET /dashboard/compare`, 30d vs previous
  30d), "Why this score?" modal (stored `verification_reasons`, now also on
  dashboard payloads), print-report button.

**New backend endpoints** (all deterministic, core rule intact):
`GET /complaints/mine`, `GET /complaints/nearby`,
`POST /complaints/suggest-category`, `GET /users/me/stats`,
`GET /dashboard/compare`, `GET /dashboard/alerts`.

**Testing & docs**
- Backend: pytest + httpx (`backend/tests/`, `requirements-dev.txt`) — pure
  rule modules + endpoint validation via TestClient with overrides; no DB
  needed. Frontend: vitest + Testing Library (`vitest.config.ts`) — i18n
  translation-contract test + ui component tests; `npm test`.
- `docs/API.md`, `docs/TESTING.md`, `docs/USER_GUIDE.md`; README updated.

**Still true / unchanged gaps:** the deferred items in section 5 below
(App Check registration, Token Creator grant, demo-data cleanup, stale
Cloud SQL IP allowlist) and the pre-existing note that the two 2026-07-08
migrations (`a1b2c3d4e5f7`, `b2c3d4e5f6a8`) are **not yet applied to the
live DB** — do not redeploy the backend before running them.

---

*The sections below describe the 2026-07-05 session and are kept for
history. The "uncommitted" framing below is outdated — that work was
committed on 2026-07-08.*

---

## 0. Plain-language summary (for anyone, not just developers)

**Before this session:** JanVaani let a citizen submit a complaint (text, voice, or photo) and an MP could see a basic list of complaints for their constituency, plus a single priority score based on education data.

**After this session:** it works the same way for a citizen, but the MP now gets a much richer, AI-assisted decision dashboard, and two real bugs were fixed that were silently losing data. Nothing about *how a citizen submits a complaint* changed — all the new screens are on the MP side.

### What a citizen sees differently
Nothing new to look at — but two things now work that were silently broken before:
- **Recording a voice complaint and submitting without typing anything** used to save with a blank description. It now gets automatically transcribed, so it actually shows up with real text.
- **Uploading a photo without typing anything** used to do the same — save blank. It now gets a one-line AI description of what's in the photo.

### What an MP sees differently (all on the `/dashboard` page)
1. **A hamburger menu (☰) in the top corner** — wasn't there before. It opens one new page: **"Update gov data"**, where an MP can upload an Excel/CSV/PDF file of government statistics, or pull data directly from a data.gov.in link. An AI reads the file, figures out what it is, and shows whether it trusts the data enough to save it.
2. **"Linked issues" section (new)** — if several different complaints (say, a school complaint, a bus complaint, and a road complaint) are coming from the same area, this section says so, with a plain-English guess at the shared cause and a confidence percentage.
3. **A live map (new)** — every complaint that has a location now shows as a coloured dot on a map of the constituency, so an MP can see clusters/hotspots visually instead of reading a list.
4. **A badge on every complaint** reading something like "Strong evidence · 87%" or "Weak evidence · 20%" — this tells the MP how much independent confirmation a complaint has (photo evidence, GPS, other similar complaints, government records), so obviously-thin complaints don't get the same weight as well-corroborated ones.
5. **The "Priority evidence" score at the top** is smarter now — it used to only look at education statistics; now it also factors in whatever other government data (health, roads, water, etc.) the MP has uploaded, wherever it's corroborated by real citizen complaints.

### What changed that nobody will ever see, but matters
- Two backend endpoints (a way to list *all* complaints in the system) had **no login check at all** — anyone who found the web address could read every citizen's complaints. That's now locked to the MP who owns that constituency.
- Every complaint's audio recording and photo were sitting on a **permanently public web link** — anyone with the link, forever, could open them. Those links are now locked down; the app still shows them to the MP, but through a link that expires after an hour.

---

## 1. Already uncommitted before this session (not part of this work)

This was in-progress work from before this conversation started — listed here only so it's not confused with what follows.

- `backend/app/admin_auth.py`, `backend/app/crypto.py` — admin auth (HMAC device-secret + bcrypt) and field encryption
- `backend/app/api/users.py`, `backend/app/models/user_identity.py` — user identity sync / profile endpoints
- `backend/app/models/mp_allowlist.py`, `backend/app/schemas/admin.py` — MP allowlist system
- `backend/alembic/versions/0e278c252d52_*`, `39530dd936af_*`, `9eb7d7a5fa6a_*` — corresponding migrations
- `src/app/onboarding/page.tsx`, `src/app/profile/page.tsx`, `src/lib/session.tsx`, `src/lib/constants.ts`, `src/lib/dashboardData.ts` — onboarding/profile UI
- `tools/admin_cli.py` — device-bound local CLI for admin operations

---

## 2. Built in this session

### 2.1 Gov-data upload pipeline (new capability)
MP dashboard hamburger menu → **"Update gov data"** → upload Excel/CSV/PDF, or pull directly from a data.gov.in API resource. Runs through a 3-step AI pipeline (Gemini schema/category detection → data-quality check → plain-language summary), with a confidence threshold deciding commit vs. "needs review" — Python decides, AI only proposes.

**New files:**
- `backend/app/parsers.py` — Excel/CSV/PDF → rows
- `backend/app/api/gov_data.py` — `/gov-data/upload`, `/gov-data/import-api`, `/gov-data/imports`
- `backend/app/models/gov_data_import.py` — `GovDataImport` (audit trail) + `GovDataRecord` (normalized rows)
- `backend/app/schemas/gov_data.py`
- `backend/alembic/versions/c1a2b3d4e5f6_add_gov_data_imports_and_records.py`
- `src/app/gov-data/page.tsx` — MP upload UI + import history

### 2.2 Voice & photo AI (bug fix + new capability)
**Found and fixed a real bug:** voice-mode and photo-only complaint submissions were being stored with **empty text** — the MP dashboard showed nothing for them.

- `backend/app/gemini_client.py` — `transcribe_audio()` (Gemini audio understanding, not a separate Speech-to-Text call) and `analyze_photo()` (Gemini vision, returns description + confidence + issue_visible)
- `backend/app/api/complaints.py` — wires both into `create_complaint()`; failures never block submission

### 2.3 Complaint Verification Score (Trust + Explainability)
Every complaint now gets a **Strong / Moderate / Weak** evidence badge, computed from independent signals — never AI-invented:
- Photo AI confidence (if a photo was attached)
- GPS presence
- Count of other complaints in the same category/constituency (last 90 days)
- MP-uploaded government data corroboration (same category, same district)

**New file:** `backend/app/verification.py`
**Modified:** `backend/app/models/complaint.py`, `backend/app/schemas/complaint.py` (added `verification_confidence`, `verification_status`, `verification_reasons`)
**Migration:** `backend/alembic/versions/d2e3f4a5b6c7_add_verification_fields_to_complaints.py`

### 2.4 Google Maps Hotspot Map
All of an MP's constituency complaints plotted on a map, category-colour-coded markers, click for details.

- `src/components/HotspotMap.tsx` — loads Google Maps JS API via a plain `<script>` tag (no npm package)
- `src/types/google-maps.d.ts` — minimal ambient types for the above
- `backend/app/schemas/dashboard.py` / `backend/app/api/dashboard.py` — new `map_points` field on `/dashboard/summary`

### 2.5 Community Consensus Graph ("Linked issues")
Groups nearby complaints across **different** categories (GPS-grid bucketed, pure Python) and asks Gemini whether they plausibly share one root cause — a hypothesis with a confidence score, never a stored fact.

- `backend/app/consensus.py`
- `backend/app/api/dashboard.py` — new `GET /dashboard/consensus`
- Dashboard "Linked issues" section

### 2.6 Evidence engine upgrade
`backend/app/evidence.py` now also scores MP-uploaded gov-data (health/roads/water/etc., not just education) — but only when citizen complaints in the same district independently corroborate the same category. No invented thresholds for unfamiliar metrics.

### 2.7 New `/dashboard` API + full dashboard UI
- `backend/app/api/dashboard.py`, `backend/app/schemas/dashboard.py` (new — not in last commit)
- `src/app/dashboard/page.tsx` — KPIs, Priority evidence, Linked issues, Hotspot map, Themes, Recent submissions (with verification badges), hamburger menu

### 2.8 Security hardening
- **Firebase App Check** wired in (`backend/app/app_check.py`, `src/lib/firebase.ts`) — soft-gated behind `ENFORCE_APP_CHECK` env flag, safe default off
- **Secrets audit**: confirmed no committed secrets/keys anywhere in the repo; `GOV_DATA_API_KEY` was missing from the Secret Manager wiring in `backend/main.py` — fixed
- **Storage lockdown** (the big one): `storage.rules` previously allowed `allow read: if true` on all complaint media (audio/photos) — **publicly and permanently readable by anyone with a URL**. Now `allow read: if false`; the backend mints short-lived (60 min) signed URLs on demand via the Admin SDK, which bypasses Security Rules. New file: `backend/app/media.py`. **This has been deployed** (`firebase deploy --only storage`) and verified: direct public access now returns 403; signed URLs return 200.
- **Fixed an unauthenticated public endpoint**: `GET /complaints` and `GET /complaints/{id}` had **no auth at all** — anyone could list every citizen's complaints, including media URLs. Now require MP auth, scoped to the requesting MP's own constituency.
- `backend/app/gemini_client.py` — `transcribe_audio`/`analyze_photo` now fetch media via the Admin SDK (`app/media.py`) instead of a plain public HTTPS fetch, since the URLs they read are no longer publicly reachable either.

### 2.9 Demo data tooling
- `backend/scripts/seed_demo_data.py` — generates N realistic complaints (categories, GPS hotspots, growth-skewed dates) for a given constituency, makes **zero Gemini calls** (verification scores computed in-memory). Supports `--delete` to cleanly remove only seeded rows (identified by `user_id IS NULL`, which real complaints never have).
- Used to seed 5000 demo complaints for constituency "Test Constituency", then verified against the live MP dashboard.

---

## 3. Full file list (this session's changes only)

**New (untracked) files:**
```
backend/app/api/dashboard.py
backend/app/api/gov_data.py
backend/app/app_check.py
backend/app/consensus.py
backend/app/evidence.py
backend/app/gemini_client.py
backend/app/media.py
backend/app/models/gov_data_import.py
backend/app/models/gov_education_stat.py
backend/app/parsers.py
backend/app/schemas/dashboard.py
backend/app/schemas/gov_data.py
backend/app/verification.py
backend/scripts/  (import_gov_education.py, seed_demo_data.py)
backend/alembic/versions/1e19cbbf7777_*.py  (pre-existing but untracked)
backend/alembic/versions/5f3866c03df8_*.py  (pre-existing but untracked)
backend/alembic/versions/8f646de7425b_*.py  (pre-existing but untracked)
backend/alembic/versions/c1a2b3d4e5f6_add_gov_data_imports_and_records.py
backend/alembic/versions/d2e3f4a5b6c7_add_verification_fields_to_complaints.py
src/app/gov-data/page.tsx
src/components/HotspotMap.tsx
src/types/google-maps.d.ts
storage.rules
```

**Modified this session:**
```
backend/app/api/complaints.py       — voice/photo AI, verification scoring, auth fix, signed URLs
backend/app/models/complaint.py     — verification_* columns
backend/app/schemas/complaint.py    — verification_* fields
backend/app/config.py               — firebase_storage_bucket setting
backend/main.py                     — GOV_DATA_API_KEY added to Secret Manager wiring
backend/requirements.txt            — +pandas, openpyxl, pdfplumber, python-multipart, google-cloud-storage
src/app/dashboard/page.tsx          — full dashboard rebuild (map, consensus, verification badges, menu)
src/services/api.ts                 — all new endpoint calls + App Check headers
src/lib/firebase.ts                 — App Check init
.env.example / .env.local           — Maps key, App Check keys
storage.rules                       — public read → signed-URL-only
```

**Deleted:** nothing removed from the repo this session.

---

## 4. Infrastructure actions already performed (not just code)

- ✅ `alembic upgrade head` run against the live Cloud SQL database (added `gov_data_imports`, `gov_data_records` tables + verification columns to `complaints`)
- ✅ `GOV_DATA_API_KEY` secret confirmed to exist in Google Secret Manager
- ✅ `backend/.env`'s `DATABASE_URL` password corrected (fetched fresh from Secret Manager)
- ✅ New `storage.rules` deployed to Firebase (`firebase deploy --only storage`) — verified live (403 on public access, 200 on signed URLs)
- ✅ 5000 demo complaints seeded for "Test Constituency", verified live on the MP dashboard
- ✅ `roles/aiplatform.user` granted to `princeojha436@gmail.com` on `vipasana-499205`

## 5. Outstanding / not yet done

- ❌ **`roles/aiplatform.user` NOT yet granted to `itsvineetwork@gmail.com`** — this is the actual Application Default Credentials identity used for local Gemini calls; without it, every Gemini call from this machine fails with `403 PERMISSION_DENIED`. Run:
  ```
  gcloud projects add-iam-policy-binding vipasana-499205 --member="user:itsvineetwork@gmail.com" --role="roles/aiplatform.user"
  ```
- ✅ ~~Nothing in this session has been `git commit`-ed~~ — committed 2026-07-08 in three commits (backend status workflow/notifications/ranked-issues, frontend dashboard features, roadmap doc)
- ⏸️ **App Check — DEFERRED (2026-07-08, user decision).** `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is empty in `.env.local`; the web app was never registered for App Check (reCAPTCHA Enterprise API not enabled on the project either). `ENFORCE_APP_CHECK` must stay **off** in production until a site key exists AND a frontend build carrying it is deployed — enabling it earlier would 401 every live submission. The Maps key exists in `.env.local` and gets baked into Hosting builds from this machine; deliberately NOT committed to `.env.production` because both GitHub remotes are public repos.
- ⏸️ **Service Account Token Creator — verified NOT granted, grant DEFERRED (2026-07-08, user decision).** The `api` function runs as `1044819117404-compute@developer.gserviceaccount.com`; its SA-level IAM policy is empty and `roles/editor` does not include `iam.serviceAccounts.signBlob`. The `serviceAccountKey.json` fallback (`GCP_CREDENTIALS_PATH`) is excluded from function deploys by `firebase.json`, so in production `generate_signed_url()` fails and `media.signed_url()` returns `None` — media links are null in prod until the grant is made:
  ```
  gcloud iam service-accounts add-iam-policy-binding 1044819117404-compute@developer.gserviceaccount.com --member="serviceAccount:1044819117404-compute@developer.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator" --project=vipasana-499205
  ```
- ⏸️ **Demo data cleanup — attempted 2026-07-08, blocked, DEFERRED (user decision).** This machine's public IP rotated to `49.36.136.255` but Cloud SQL only authorizes the stale `49.36.176.160/32`, so the delete script can't connect. To run it later: refresh the authorized network, then `python scripts/seed_demo_data.py --constituency "Test Constituency" --delete`. (Same blocker applies to running Alembic migrations from this machine — note the two NEW migrations committed 2026-07-08, `a1b2c3d4e5f7` + `b2c3d4e5f6a8`, are NOT yet applied to the live DB; the backend must not be redeployed before they run.)
- ❌ FCM push notifications (discussed, not built)

---

## 6. Does this actually solve a real problem for the MP? (in plain language)

An MP's real problem isn't "too few complaints" — it's the opposite: **too many complaints, no way to tell which ones are real and which ones matter most.** Everything below is about closing that gap honestly, without the app just guessing and sounding confident.

### The core rule this whole system follows
**The AI is never allowed to invent a priority, a score, or a "this matters" decision out of thin air.** Every number the MP sees must be traceable back to something real — a count of complaints, a government record, a photo, a location. The AI's only job is to *read* things (a voice note, a photo, a messy spreadsheet) and to *explain* a number in plain English — never to decide the number itself. That decision is always made by a fixed, readable set of rules.

### How "is this complaint even real?" gets answered
Instead of trusting every complaint equally, each one is checked against evidence that has nothing to do with what the citizen typed:
- Was there a photo, and does it actually show a real problem (not a blank/random image)?
- Was a location attached (GPS), or is it just a name typed in?
- Have other people, independently, complained about the same thing in the same area recently?
- Does the government's own data (the files/records an MP has uploaded) back up that this is a known issue in that area?

The more of these that line up, the higher the confidence shown to the MP ("Strong evidence" vs "Weak evidence"). A single unverifiable text complaint will never be shown with the same confidence as ten photo-and-GPS-backed complaints from the same street.

### How "which problem matters most" gets answered
The system doesn't just count complaints — it looks for **patterns that are more convincing than an individual complaint**:
- **Is it getting worse over time**, or is it a one-off? (a sudden spike in complaints about one thing is more urgent than a steady trickle)
- **Are different-looking complaints actually the same underlying issue?** (a school complaint, a bus complaint, and a road complaint from the same area might really be "there's no proper road to that area" — the system looks for this and says so, as a guess with a confidence number, never as a stated fact)
- **Does government data already confirm the gap?** (e.g. official records already show only one school for a large population — that's a much stronger basis for a decision than complaints alone)

### Why raw numbers aren't enough, and what's still missing
A number like "89% pass rate" or "42 complaints" means very little by itself — it only becomes useful compared to something: last year, a nearby area, or a state average. Right now the system does this partially (it does track "complaints are rising 40% this month," for example) but does **not yet** compare one area's government data against similar areas elsewhere — that's the single biggest improvement still on the table, because it would turn plain numbers into meaningful ones.

The other honest gap: the system currently has no way of checking whether its own recommendations actually worked. It can say "this is the top priority" — but nothing yet records whether the MP acted on it, or whether the problem was genuinely resolved afterward. Without that feedback loop, this is a strong "here's the most defensible way to prioritize a big pile of complaints" tool — but it cannot yet claim to have proven it solves problems in the real world. That would need to be tracked over months, not something a hackathon build can show on day one.
