# JanVaani — Product Requirements (v2, stack-aligned)

**Author:** prince.kumar@premnathrail.com · **Updated:** 2026-07-01 · **Status:** Hackathon build (7-day)

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
- See whether each need is **rising, falling or steady** over time — not just its total.
- **Compare two competing works** (e.g. school upgrade vs vocational centre) on evidence.
- **Upload our development plan** so proposed projects are scored against real demand.
- **Bulk-import** our complaint register (CSV/Excel) so offline complaints rank too.
- **Adjust weighting** (demand vs gap vs equity) and see ranks recompute transparently.
- **Drill from a theme to source submissions** to verify the AI — including the citizen's
  photo and voice note.
- **Mark a work's response status** (acknowledged → sanctioned → in progress → done) and
  have it show on a public accountability board.
- **Ask the dashboard in plain language** ("what's rising in Meskaur?") and act through it,
  confirming any change before it applies.

**Citizen (accountability)**
- See on a **public board** how the need I raised has progressed — that I was heard *and* acted on.

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

### Shipped since v2 (v3.1) — beyond the original P0 core
| # | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| P0-9 | **Momentum**: rising/falling/flat + sparkline per work, from `createdAt` | trend badge + 12-week sparkline on every card | ✅ |
| P0-10 | **Accountability status** + public board | MP sets status; `/status` shows it to citizens | ✅ |
| P0-11 | **Media evidence** in detail view | MP plays voice note + sees reference photo | ✅ |
| P0-12 | **Reference photo in voice flow** | citizen can attach a photo alongside a voice note | ✅ |
| P0-13 | **Bulk CSV/Excel import** with a downloadable template | uploaded rows rank + map like citizen voices | ✅ |
| P0-14 | **Gemini dashboard assistant** (grounded, answer-and-confirm) | NL Q&A over live data; proposes actions MP confirms | ✅ |
| P0-15 | **Auto-recompute** on new submission / bulk import | KPIs, momentum, hotspots update without manual trigger | ✅ |
| P0-16 | **Citizen account menu + "Your queries"** | full-screen menu (body-portaled) shows profile + each raised query with the MP's action on it | ✅ |
| P0-17 | **Map plots queries at real GPS** | demand map fits to actual submission coordinates; blank areas resolved from GPS at read time | ✅ |
| P0-18 | **Consistent area resolution** | ingest, submissions API and ranking engine resolve a blank area the *same* way (nearest-by-GPS → max-deficit), so the drill-down and the ranked work never disagree | ✅ |
| P0-19 | **Mandatory constituency on submit** | required field (prefilled from profile), stored on the submission for per-constituency routing | ✅ |
| P0-20 | **MP provisioning** (invite → activate → scoped) | admin console (`/admin/mps`), one-time invite links, constituency bound server-side; dashboard scopes voices by it | ✅ |
| P0-21 | **Momentum is now scored, not just shown** | Momentum (M) is a 7th weighted, MP-adjustable factor (default 10%), derived from the 30d-vs-prior trend (neutral 0.5 when no trend) | ✅ |
| P0-22 | **Feasibility & cost estimate agent** | MP-triggered, structured, labelled AI estimate (scope · BoQ · cost band · MPLADS eligibility · confidence) via `gemini-2.5-flash`, cached; fallback when AI off | ✅ |
| P0-23 | **Official constituency list** | ECI Lok Sabha constituencies (Bihar complete, official numbering) in one dropdown on Raise-your-voice AND admin MP-assignment — free-text removed, so voices route reliably | ✅ |
| P0-24 | **Bulk MP provisioning + access control** | admin bulk CSV/Excel MP upload with template; deactivate/reactivate revokes access (revoked accounts can't sign in) | ✅ |

> **Ranking weights (v3.2 default):** Demand 25 · Service gap 20 · Population 20 · Equity 15 · Corroboration 5 · Feasibility 5 · **Momentum 10** (was D30/G25/P20/E15/C5/F5 before Momentum was folded in). All remain live-adjustable via the dashboard sliders.

> **Naming:** the MP dashboard's public-board entry is labelled **"Action taken"** (it surfaces the response status on each need), linking to the public `/status` board.

> **Single-constituency scope (known limit):** the seeded public-data + area centroids model one constituency (Nawada, Bihar). A submission with GPS far outside it (e.g. a test from Haryana) now still appears on the map at its true coordinates, but its *area label* resolves to the nearest in-constituency block. Multi-constituency support is P2.

### Nice-to-Have (P1)
- SMS/WhatsApp/IVR intake via **Dialogflow** (proves low-connectivity reach).
- **Head-to-head comparator** view (plan vs citizen work). ✅ *(shipped)*
- **Weight sliders** to re-rank live. ✅ *(shipped)*
- Gemini **multimodal photo** issue detection feeding category/gap. ✅ *(shipped)*
- Getis-Ord Gi\* significant-hotspot flagging; Bayesian shrinkage for small samples.
- Admin re-categorisation UI.

### Future (P2)
- Aadhaar/OTP verification + anti-gaming safeguards.
- Live public-data API integrations; Earth Engine satellite gap signals.
- Citizen feedback loop: public status board shipped (v3.1); **per-citizen notification**
  (FCM/SMS when their issue's status changes) remains future — needs contact capture.
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
