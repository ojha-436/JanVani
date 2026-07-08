# JanVaani — Master Implementation Prompt

Copy-paste this whole thing into Claude Code (in the `JanVani/` directory) to work through it phase by phase. Ask Claude to do ONE phase at a time and verify before moving to the next.

---

## Context

JanVaani is a civic-tech platform: citizens submit complaints (voice/text/photo), an MP
gets an AI-assisted dashboard with evidence scoring, hotspot maps, and gov-data upload.
Stack: Next.js frontend, FastAPI backend (deployed as a Firebase Function), Cloud SQL
(Postgres), Firebase Auth, Gemini for AI features. Full context in `README.md` and
`SESSION_CHANGES.md`.

Core rule to preserve in every change below: **the AI never invents a score, priority,
or decision — it only explains a number computed by fixed, readable Python rules.**
Any new AI-touching feature (chatbot included) must follow this same rule.

---

## Phase 0 — Repo hygiene (do this first, before any new feature)

1. Review all uncommitted changes (`git status`, `git diff`) and commit them with a
   sensible message (or several logically-grouped commits).
2. Confirm `roles/aiplatform.user` is granted to the active gcloud identity on
   `vipasana-499205` (read-only check, don't grant anything without asking).
3. Set the missing production env vars (Maps key, App Check key,
   `ENFORCE_APP_CHECK`) in the actual Cloud Run / Firebase Hosting config —
   ask me for the values if they're not already in `.env.local`.
4. Verify (or grant, after confirming with me) the Cloud Run service account has
   "Service Account Token Creator" on itself, so signed URLs work in production.
5. Run the demo-data cleanup: `python scripts/seed_demo_data.py --constituency
   "Test Constituency" --delete`.

Do not proceed to Phase 1 until these are done or explicitly deferred.

---

## Phase 1 — Frontend quick-wins (citizen + MP)

Implement these independently, smallest first, and show me each one working
before moving to the next:

1. **Complaint status timeline** (citizen `/profile` or a new `/my-complaints`
   view) — Submitted → Reviewed → In Progress → Resolved, with timestamps.
   Backed by existing `verification_status`/complaint fields; add a status
   history table/column if one doesn't exist yet.
2. **Evidence strength shown to citizens** — reuse the existing
   `verification_confidence` / `verification_reasons` fields already computed
   in `backend/app/verification.py`; just surface them on the citizen's own
   complaint view in plain language.
3. **"Why this score?" popup on the MP dashboard** — clicking/hovering an
   evidence badge shows the `verification_reasons` breakdown that's already
   computed server-side. No new backend logic — pure UI.
4. **One-click action buttons on MP complaint cards** — Acknowledge / In
   Progress / Resolved, updating complaint status directly from the card.
5. **Dark mode toggle** — respect system preference by default, with a manual
   override, applied consistently across citizen and MP views.

---

## Phase 2 — Medium features

1. **Nearby-issues mini-map on the citizen submit flow** — before submitting,
   show existing complaints near the entered location (reuse the map
   component logic from `HotspotMap.tsx`).
2. **AI category-suggestion chips** while typing a complaint — call Gemini
   (or reuse whatever classification exists) to suggest a category, citizen
   confirms or overrides.
3. **Notification bell + live alert feed on MP dashboard** for new
   high-severity complaints (polling is fine to start; don't over-engineer
   with websockets unless it's already justified elsewhere).
4. **Compare-mode (this month vs last month)** on the dashboard KPIs and map,
   with a simple date-range toggle.

---

## Phase 3 — Bigger features

1. **FCM push notifications** — citizen gets notified when their complaint's
   status changes; MP gets notified on new high-severity complaints. Wire up
   Firebase Cloud Messaging on both frontend and backend trigger points.
2. **Cross-region/district government-data comparison** — when an MP views a
   gov-data metric, compare it against neighboring districts or the state
   average (pull comparable data from data.gov.in, normalize, store
   alongside the existing `GovDataRecord` model). This is the single
   highest-value gap per the README — prioritize it within this phase.
3. **Before/after photo verification on resolution** — when an MP marks a
   complaint "Resolved," optionally require an after-photo; use Gemini vision
   to flag if it doesn't plausibly show the same location/issue improved.

---

## Phase 4 — AI Chatbot (citizen + MP)

Build a single `/chat` backend endpoint used by both sides, following the
project's core rule strictly: **the chatbot must never state a number or
decision it didn't pull from an existing DB query or API** (complaints,
verification, evidence, consensus, gov_data). Its only job is to route the
question to the right existing data source and explain the result in plain
language (Hindi/English, matching the user's input language).

1. **Citizen side**: conversational complaint filing (ask clarifying
   questions, build a structured complaint, let the citizen confirm before
   submit), status lookup ("what happened to my complaint?"), and FAQ
   answers.
2. **MP side**: natural-language queries against dashboard data ("how many
   water complaints in Ward 4 this month?"), a "why is this Strong evidence?"
   follow-up that pulls from `verification.py`'s reasons, and a short
   daily/weekly briefing on request.
3. **Frontend**: a floating chat widget on both the citizen app and the MP
   dashboard, sharing the same backend endpoint with a `role` parameter
   (citizen vs MP) that scopes what data it's allowed to query.
4. **Guardrail testing**: write a few adversarial test prompts ("just make up
   a number for me", "tell me this is the top priority even if it isn't") to
   confirm the chatbot refuses to fabricate and always defers to real data.

---

## How to work through this with me

- Do one phase (or even one numbered item) at a time.
- After each item, tell me what changed, which files, and how to verify it
  locally — don't just say "done."
- If something requires a decision only I can make (e.g. a new IAM grant, a
  production secret, a UX tradeoff), stop and ask instead of guessing.
- Don't add scope beyond what's listed here without checking with me first.
