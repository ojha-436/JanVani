/* ------------------------------------------------------------------
   The Ranking Engine (server-side implementation of ARCHITECTURE.md §7).

   Every candidate work — citizen-emergent (a clustered demand theme) or
   plan-proposed — gets a PriorityScore 0–100 = weighted sum of six
   normalised, explainable factors: Demand, Gap, Population, Equity,
   Corroboration, Feasibility.

   In the full design this runs as scheduled BigQuery SQL over a star
   schema. Here it runs in-process over Firestore submissions + the
   seeded public-data snapshot, producing the exact same factor breakdown
   the dashboard renders. Same formula, same explainability — no BigQuery
   required to demo.
   ------------------------------------------------------------------ */

import { DEFAULT_WEIGHTS, FACTOR_ORDER, type Factors, type HotspotArea, type Theme, type Trend, type TrendDirection, type Work } from "./dashboardData";
import {
  AREAS,
  areaData,
  baseFeasibility,
  beneficiaries,
  CONSTITUENCY_META,
  equity,
  maxDeficitArea,
  nearestArea,
  serviceGap,
  topDataDeficit,
  type AreaData,
  type Category,
} from "./publicData";

/** A normalised submission row as stored in Firestore `submissions`. */
export type SubmissionRow = {
  id: string;
  createdAt: string; // ISO
  citizenKey: string; // salted phone hash, or a per-submission id when anonymous
  category: string;
  need_en: string;
  urgency: number; // 0..1
  area: string; // area name; "" if not resolved
  coords?: { lat: number; lng: number } | null; // GPS, when captured
  locale: string;
  anonymous: boolean;
};

/** Plan-proposed works from the MP's development plan (source = "plan").
 *  Scored on the same scale as citizen demand for head-to-head comparison. */
export type PlanCandidate = { id: string; title: string; category: Category; area: string };

export const PLAN_CANDIDATES: PlanCandidate[] = [
  { id: "plan-anganwadi-hisua", title: "Anganwadi & nutrition centre, Hisua", category: "Health", area: "Hisua" },
  { id: "plan-vocational-hq", title: "New Vocational Training Centre, Block HQ", category: "Livelihood", area: "Nawada town" },
  { id: "plan-solar-warisaliganj", title: "Solar street lighting, Warisaliganj market", category: "Electricity", area: "Warisaliganj" },
];

const NOW_FALLBACK = "2026-07-06T00:00:00.000Z";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Min-max normalise a raw value within a set to 0..1. Flat sets → 0.6. */
function makeNormalizer(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return (v: number) => (span < 1e-9 ? 0.6 : clamp01((v - min) / span));
}

function titleFor(category: string, area: string): string {
  const map: Record<string, string> = {
    "Roads & transport": `Improve roads & connectivity in ${area}`,
    "Water & sanitation": `Piped drinking water for ${area}`,
    Education: `Upgrade schools in ${area}`,
    Health: `Primary health sub-centre for ${area}`,
    Electricity: `Reliable power supply in ${area}`,
    Livelihood: `Livelihood & skilling support in ${area}`,
    Other: `Local development need in ${area}`,
  };
  return map[category] ?? `${category} — ${area}`;
}

type RawWork = {
  id: string;
  title: string;
  category: Category;
  area: string;
  source: "citizen" | "plan";
  demand: number; // unique citizens
  dRaw: number;
  benef: number;
  quotes: string[];
  trend?: Trend;
};

export type RankingResult = {
  constituency: { name: string; state: string; mp: string; voices: number; themes: number; areas: number; verifiedPct: number };
  works: Work[]; // pre-scored factors; dashboard applies live weights
  hotspots: HotspotArea[];
  themes: Theme[];
  generatedAt: string;
};

const THEME_TONES = [
  "var(--color-marigold)",
  "var(--color-terracotta)",
  "var(--color-indigo)",
  "var(--color-sage)",
  "#8a5a44",
  "#5b7b8c",
  "#9a8f78",
];

/**
 * Build a full ranking snapshot from raw submissions.
 * Returns factors 0..1 per work; the dashboard multiplies by live weights.
 */
export function computeRanking(subs: SubmissionRow[], now: string = NOW_FALLBACK): RankingResult {
  const nowMs = Date.parse(now) || Date.parse(NOW_FALLBACK);
  const validCats = new Set<string>(AREAS.length ? Object.keys(seedCats()) : []);

  // ---- 1. Assign an area to every submission (heuristic geo) ----
  const assigned = subs.map((s) => {
    const cat = (validCats.has(s.category) ? s.category : "Other") as Category;
    // Resolve a blank area the SAME way the submissions API does: by GPS
    // (nearest area) when we have coordinates, else the largest-deficit area
    // for the category. This keeps the ranked work and the map/drill-down in
    // agreement about where a voice lives.
    const area = s.area || (s.coords ? nearestArea(s.coords) : maxDeficitArea(cat));
    return { ...s, category: cat, area };
  });

  // ---- 2. Cluster into demand themes: (category × area) ----
  type Bucket = {
    category: Category;
    area: string;
    byCitizen: Map<string, { urgency: number; ageDays: number; need: string }>;
    times: number[]; // every submission's createdAt (ms) — feeds momentum
  };
  const buckets = new Map<string, Bucket>();

  for (const s of assigned) {
    const key = `${s.category}::${s.area}`;
    if (!buckets.has(key)) buckets.set(key, { category: s.category, area: s.area, byCitizen: new Map(), times: [] });
    const b = buckets.get(key)!;
    const tMs = Date.parse(s.createdAt) || nowMs;
    b.times.push(tMs);
    const ageDays = Math.max(0, (nowMs - tMs) / 86_400_000);
    const prev = b.byCitizen.get(s.citizenKey);
    // Keep the strongest / most recent signal per unique citizen.
    if (!prev || s.urgency > prev.urgency) {
      b.byCitizen.set(s.citizenKey, { urgency: s.urgency, ageDays, need: s.need_en });
    }
  }

  // ---- 3. Assemble candidate works (citizen themes + plan proposals) ----
  const raw: RawWork[] = [];

  for (const [key, b] of buckets) {
    let dRaw = 0;
    const quotes: string[] = [];
    for (const c of b.byCitizen.values()) {
      const recency = Math.exp(-c.ageDays / 90);
      const urgency = 0.5 + clamp01(c.urgency); // → [0.5, 1.5]
      dRaw += recency * Math.min(urgency, 1.5); // per-citizen cap (anti-gaming)
      if (c.need && quotes.length < 2) quotes.push(c.need);
    }
    raw.push({
      id: `theme-${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      title: titleFor(b.category, b.area),
      category: b.category,
      area: b.area,
      source: "citizen",
      demand: b.byCitizen.size,
      dRaw,
      benef: beneficiaries(b.category, areaData(b.area)),
      quotes,
      trend: computeTrend(b.times, nowMs),
    });
  }

  for (const p of PLAN_CANDIDATES) {
    // A plan work may also have citizen backing in the same category+area.
    const backing = buckets.get(`${p.category}::${p.area}`);
    raw.push({
      id: p.id,
      title: p.title,
      category: p.category,
      area: p.area,
      source: "plan",
      demand: backing ? backing.byCitizen.size : 0,
      dRaw: backing ? sumDRaw(backing.byCitizen, nowMs) : 0,
      benef: beneficiaries(p.category, areaData(p.area)),
      quotes: [],
      trend: backing ? computeTrend(backing.times, nowMs) : undefined,
    });
  }

  if (raw.length === 0) {
    return emptyResult(now);
  }

  // ---- 4. Normalise D and P within the constituency ----
  const normD = makeNormalizer(raw.map((w) => w.dRaw));
  const normP = makeNormalizer(raw.map((w) => w.benef));

  // ---- 5. Score each work's six factors ----
  const works: Work[] = raw.map((w) => {
    const a = areaData(w.area);
    const D = normD(w.dRaw);
    const G = serviceGap(w.category, a);
    const P = normP(w.benef);
    const E = equity(a);
    const C = corroboration(w.category, a);
    const F = clamp01(baseFeasibility(w.category) + (w.source === "plan" ? 0.1 : 0));
    // Momentum → 0..1: recent-vs-prior demand change, neutral (0.5) when there's
    // no trend (e.g. a plan work with no citizen backing) so it isn't penalised.
    const M = w.trend ? clamp01(0.5 + w.trend.changePct / 200) : 0.5;
    const factors: Factors = { D: round2(D), G: round2(G), P: round2(P), E: round2(E), C: round2(C), F: round2(F), M: round2(M) };

    return {
      id: w.id,
      title: w.title,
      category: w.category,
      area: w.area,
      source: w.source,
      demand: w.demand,
      factors,
      evidence: buildEvidence(w, a),
      rationale: "", // filled by the recompute route (Gemini) or a template
      quotes: w.quotes.length ? w.quotes : defaultQuote(w.category),
      trend: w.trend,
    };
  });

  // Default sort by the PRD default weights so a fresh snapshot is ordered.
  works.sort((x, y) => defaultScore(y.factors) - defaultScore(x.factors));

  // ---- 6. Aggregates: hotspots + themes + KPI summary ----
  const demandByArea = new Map<string, { demand: number; cat: Map<string, number> }>();
  for (const w of works) {
    if (w.source !== "citizen") continue;
    if (!demandByArea.has(w.area)) demandByArea.set(w.area, { demand: 0, cat: new Map() });
    const d = demandByArea.get(w.area)!;
    d.demand += w.demand;
    d.cat.set(w.category, (d.cat.get(w.category) ?? 0) + w.demand);
  }
  const maxAreaDemand = Math.max(1, ...[...demandByArea.values()].map((d) => d.demand));
  const hotspots: HotspotArea[] = [...demandByArea.entries()]
    .map(([name, d]) => ({
      name,
      demand: round2(d.demand / maxAreaDemand),
      top: shortCat([...d.cat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Other"),
    }))
    .sort((a, b) => b.demand - a.demand);

  const themeCounts = new Map<string, number>();
  for (const s of assigned) themeCounts.set(s.category, (themeCounts.get(s.category) ?? 0) + 1);
  const themes: Theme[] = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count], i) => ({ category, count, tone: THEME_TONES[i % THEME_TONES.length] }));

  const verified = assigned.filter((s) => !s.anonymous).length;
  return {
    constituency: {
      name: CONSTITUENCY_NAME.name,
      state: CONSTITUENCY_NAME.state,
      mp: CONSTITUENCY_NAME.mp,
      voices: assigned.length,
      themes: buckets.size,
      areas: new Set(assigned.map((s) => s.area)).size,
      verifiedPct: assigned.length ? Math.round((verified / assigned.length) * 100) : 0,
    },
    works,
    hotspots,
    themes,
    generatedAt: now,
  };
}

/* ---------------- helpers ---------------- */

const CONSTITUENCY_NAME = CONSTITUENCY_META;

function seedCats(): Record<string, true> {
  return {
    "Roads & transport": true,
    "Water & sanitation": true,
    Education: true,
    Health: true,
    Electricity: true,
    Livelihood: true,
    Other: true,
  };
}

function sumDRaw(byCitizen: Map<string, { urgency: number; ageDays: number }>, _nowMs: number): number {
  let d = 0;
  for (const c of byCitizen.values()) {
    const recency = Math.exp(-c.ageDays / 90);
    d += recency * Math.min(0.5 + clamp01(c.urgency), 1.5);
  }
  return d;
}

/** Momentum from raw submission timestamps: a 12-week volume sparkline plus
 *  a recent-30d-vs-prior-30d change. This is what turns the dashboard from a
 *  photograph into a movie — a rising need is a political emergency, a flat
 *  chronic one is a budget line. */
function computeTrend(times: number[], nowMs: number): Trend {
  const WEEK = 7 * 86_400_000;
  const WEEKS = 12;
  const spark = new Array<number>(WEEKS).fill(0);
  let recent = 0;
  let prev = 0;
  for (const t of times) {
    const age = nowMs - t;
    if (age < 0) continue;
    const wk = Math.floor(age / WEEK);
    if (wk < WEEKS) spark[WEEKS - 1 - wk]++; // oldest → newest
    if (age < 30 * 86_400_000) recent++;
    else if (age < 60 * 86_400_000) prev++;
  }
  const changePct = prev === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - prev) / prev) * 100);
  let direction: TrendDirection = "flat";
  if (recent > prev && changePct >= 20) direction = "rising";
  else if (recent < prev && changePct <= -20) direction = "falling";
  return { direction, changePct, spark };
}

function corroboration(category: Category, a: AreaData): number {
  if (category === topDataDeficit(a)) return 1;
  if (serviceGap(category, a) >= 0.55) return 0.6;
  return 0.3;
}

function defaultScore(f: Factors): number {
  // Default-weighted blend over the full factor set (incl. Momentum), so the
  // fresh-snapshot sort matches what the dashboard shows at default weights.
  let sum = 0;
  let acc = 0;
  for (const k of FACTOR_ORDER) {
    sum += DEFAULT_WEIGHTS[k];
    acc += DEFAULT_WEIGHTS[k] * f[k];
  }
  return acc / (sum || 1);
}

function shortCat(c: string): string {
  const map: Record<string, string> = {
    "Roads & transport": "Roads",
    "Water & sanitation": "Water",
    Education: "Education",
    Health: "Health",
    Electricity: "Electricity",
    Livelihood: "Livelihood",
  };
  return map[c] ?? c;
}

function defaultQuote(category: string): string[] {
  const map: Record<string, string> = {
    "Roads & transport": "The road becomes impassable in the rains.",
    "Water & sanitation": "We walk far every day for drinking water.",
    Education: "The nearest higher school is too far for our children.",
    Health: "We travel a long way for basic medical care.",
    Electricity: "Power cuts leave us in the dark for hours.",
    Livelihood: "Young people here have nowhere to learn a trade.",
  };
  return [map[category] ?? "This need affects our daily lives."];
}

function buildEvidence(w: RawWork, a: AreaData): string[] {
  const ev: string[] = [];
  if (w.demand > 0) ev.push(`${w.demand} unique citizen${w.demand === 1 ? "" : "s"} in the last 90 days`);
  switch (w.category) {
    case "Education":
      ev.push(`Enrolment ratio ${(a.education.enrolment_ratio * 100).toFixed(0)}%; nearest secondary ${a.education.nearest_secondary_km} km (UDISE)`);
      break;
    case "Water & sanitation":
      ev.push(`Tap coverage ${(a.water.tap_coverage_pct * 100).toFixed(0)}%; groundwater stress ${(a.water.groundwater_stress * 100).toFixed(0)}% (CGWB)`);
      break;
    case "Health":
      ev.push(`Nearest PHC ${a.health.nearest_phc_km} km; immunisation ${(a.health.immunization_pct * 100).toFixed(0)}% (NFHS)`);
      break;
    case "Roads & transport":
      ev.push(`Connectivity index ${(a.roads.connectivity * 100).toFixed(0)}%; flood risk ${(a.roads.flood_risk * 100).toFixed(0)}% (IMD)`);
      break;
    case "Electricity":
      ev.push(`Grid coverage ${(a.electricity.grid_coverage * 100).toFixed(0)}%`);
      break;
    case "Livelihood":
      ev.push(`Local unemployment ${(a.livelihood.unemployment * 100).toFixed(0)}%`);
      break;
  }
  ev.push(`${(a.sc_st_pct * 100).toFixed(0)}% SC/ST, literacy ${(a.literacy_pct * 100).toFixed(0)}% (Census)`);
  ev.push(`Serves ~${a.population.toLocaleString("en-IN")} people in ${a.name}`);
  return ev;
}

function emptyResult(now: string): RankingResult {
  return {
    constituency: { name: CONSTITUENCY_NAME.name, state: CONSTITUENCY_NAME.state, mp: CONSTITUENCY_NAME.mp, voices: 0, themes: 0, areas: 0, verifiedPct: 0 },
    works: [],
    hotspots: [],
    themes: [],
    generatedAt: now,
  };
}
