# JanVaani — Product Requirements (v2, stack-aligned)

**Author:** prince.kumar@premnathrail.com · **Updated:** 2026-07-01 · **Status:** Hackathon build (7-day)

> **Implementation note (2026-07-05):** the shipped backend uses FastAPI +
> Cloud SQL (Postgres) rather than the Firestore/BigQuery/Pub-Sub pipeline
> described below, and calls Gemini directly instead of a batch worker. See
> the root [README.md](../README.md#architecture-as-built) for what's actually
> running today; this document remains the original product/goals reference.

> v2 aligns the platform to the organiser's recommended Google Cloud stack
> (Gemini / Vertex AI, BigQuery, Google Maps, Dialogflow, Speech-to-Text,
> Firebase) and sharpens the **analysis & ranking** requirements. See
> [ARCHITECTURE.md](ARCHITECTURE.md) for the technical design of the ranking engine.

---

## 1. Problem Statement

MPs receive development requests through fragmented channels — public meetings,
letters, social media, grievance portals, direct representations — while local
development plans already hold dozens of competing proposed projects. There is **no
objective way to consolidate this feedback, detect recurring needs, or weigh
competing proposals against real demand** (e.g. is a requested school upgrade
justified by enrolment and travel-distance data, versus a proposed vocational
centre?). Limited development funds get allocated by access and volume, not measured
need.

---

## 2. Goals

1. **Consolidate** multilingual, multi-channel citizen input into one structured,
   deduplicated dataset.
2. **Surface recurring themes** — cluster thousands of raw submissions into a handful
   of actionable demand themes (unique-citizen weighted).
3. **Map demand hotspots** at ward/village granularity on Google Maps.
4. **Rank competing works objectively** via a transparent, explainable score that
   fuses citizen demand with Census/UDISE/NFHS/CPCB/IMD data.
5. **Demo end-to-end in 7 days**: a citizen speaks in Hindi → it appears clustered,
   mapped and ranked on the MP dashboard with a plain-language rationale.

---

## 3. Non-Goals

1. Production identity verification / Aadhaar / anti-astroturfing hardening — *P2*.
2. Fully provisioned WhatsApp Business API (approval exceeds hackathon) — **simulate**
   or use a sandbox; SMS/IVR via Dialogflow demoed on test numbers.
3. Live authenticated government dataset APIs — use **snapshot public datasets** loaded
   into BigQuery.
4. Automated fund disbursement into MPLADS/treasury systems — we recommend and rank,
   not execute.
5. All 22 scheduled languages — prove the approach with **English + Hindi + 1–2 regional**.

---

## 4. User Stories

**Citizen (mobile-first, low literacy, regional language)**
- Record a **voice note** in my language describing a local need, without typing.
- Submit via **SMS / WhatsApp / IVR** on a basic phone with poor connectivity.
- Upload a **photo** of an issue (broken culvert, garbage, flooding) with location.
- Get a spoken/written **confirmation** my voice was counted.

**MP / office staff (decision-maker)**
- See a **ranked priority list** with a clear "why this rank" explanation.
- View a **demand hotspot map** across the constituency.
- **Compare two competing works** (e.g. school upgrade vs vocational centre) on evidence.
- **Upload our development plan** so proposed projects are scored against real demand.
- **Adjust weighting** (demand vs gap vs equity) and see ranks recompute transparently.
- **Drill from a theme to source submissions** to verify the AI.

---

## 5. Requirements

### Must-Have (P0) — 7-day demo core
| # | Requirement | Acceptance criteria |
|---|---|---|
| P0-1 | Multi-modal intake (voice/text/photo) via web | stored submission with media + metadata |
| P0-2 | Speech-to-Text + Translation to English canonical | Hindi voice → transcript + `need_en` |
| P0-3 | Gemini structured extraction (category, urgency, entities) | each submission tagged with validated JSON |
| P0-4 | Theme clustering + **unique-citizen** dedup | ≥50 submissions grouped into coherent themes |
| P0-5 | Demand hotspot map (Google Maps) | geo-tagged demand rendered as heatmap by area |
| P0-6 | **Ranking engine in BigQuery** with 6-factor explainable score | works ordered with visible sub-score breakdown |
| P0-7 | Public dataset seeded (≥1: e.g. UDISE enrolment or Census population) | used inside the `G`/`P` sub-scores |
| P0-8 | MP dashboard: ranked list + map + drill-down + Gemini rationale | single screen, end-to-end demo |

### Nice-to-Have (P1)
- SMS/WhatsApp/IVR intake via **Dialogflow** (proves low-connectivity reach).
- **Head-to-head comparator** view (plan vs citizen work).
- **Weight sliders** to re-rank live.
- Gemini **multimodal photo** issue detection feeding category/gap.
- Getis-Ord Gi\* significant-hotspot flagging; Bayesian shrinkage for small samples.
- Admin re-categorisation UI.

### Future (P2)
- Aadhaar/OTP verification + anti-gaming safeguards.
- Live public-data API integrations; Earth Engine satellite gap signals.
- Citizen feedback loop (notified when their issue drives a funded work).
- Multi-constituency / state rollout, RBAC, public transparency + audit portal.
- Bias monitoring on ranking outputs.

---

## 6. Success Metrics

**Demo / judging**
- Fresh voice submission → clustered + ranked on dashboard in **< 60 s**.
- Clustering coherence ≥ **80%** on a seeded ~150-submission set (manual judge).
- **≥ 2 non-English languages** transcribed → categorised → ranked.
- Every ranked work shows a **human-readable rationale** grounded in real data.

**Leading (pilot)** — submissions/week, % via voice, % auto-categorised without fixup.
**Lagging (impact)** — % funded works matching top-ranked priorities; triage-effort
reduction; geographic-equity variance narrowing over time.

---

## 7. Open Questions
| Question | Owner | Blocking? |
|---|---|---|
| Which 2–3 languages for the demo? | Team | **Yes (day 1)** |
| Which public dataset loads cleanest first (UDISE vs Census)? | Data | **Yes (day 1–2)** |
| Default ranking weights + can we defend them? | Team | **Yes (day 2–3)** |
| Gemini Flash vs Flash-Lite for extraction cost/latency? | Eng | No |
| Ward/village name granularity vs GPS for the map? | Eng | No |

---

## 8. Timeline (7 days)
| Day | Focus | Outcome |
|---|---|---|
| 1 | Stack, languages, dataset; scaffold; BigQuery schema; lock ranking formula | repo + schema |
| 2 | Intake (done) + Speech-to-Text + Translation wired | voice → `need_en` |
| 3 | Gemini extraction + clustering + seed ~150 submissions | raw → themes |
| 4 | **Ranking engine (BigQuery) + public dataset + sub-scores** | ranked list + "why" |
| 5 | MP dashboard: list + Maps heatmap + drill-down | core demo screen |
| 6 | Polish, multilingual E2E test, P1 stretch (comparator / sliders / Dialogflow) | demo-ready |
| 7 | Buffer, pitch deck, dry runs, fallback demo video | pitch-ready |

**Critical path:** intake → transcription → extraction → clustering → **ranking** →
dashboard. Ship a thin end-to-end slice by **Day 4**, then deepen.

---

## 9. Data sources (public)
data.gov.in · Census / NFHS (population, SC/ST, literacy, BPL, health indicators) ·
UDISE+ (schools, enrolment, dropout) · CGWB / Jal Shakti (groundwater, tap coverage) ·
CPCB (air quality) · IMD (rainfall / flood risk). Loaded as BigQuery dimension tables.
