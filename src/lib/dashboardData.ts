/* ------------------------------------------------------------------
   Seed dataset for the MP dashboard.

   In production these values are computed in BigQuery (see
   docs/ARCHITECTURE.md): each factor is normalised 0–1 within the
   constituency, and `scoreWork` is the same weighted-sum ranking the
   ranking engine runs. Here we hard-code a realistic snapshot so the
   dashboard is fully interactive for the demo.
   ------------------------------------------------------------------ */

export type FactorKey = "D" | "G" | "P" | "E" | "C" | "F";
export type Factors = Record<FactorKey, number>; // each 0..1
export type Weights = Record<FactorKey, number>; // slider "points"; normalised at score time

export const FACTOR_ORDER: FactorKey[] = ["D", "G", "P", "E", "C", "F"];

export const FACTOR_COLORS: Record<FactorKey, string> = {
  D: "var(--color-marigold)",
  G: "var(--color-terracotta)",
  P: "var(--color-indigo)",
  E: "var(--color-sage)",
  C: "#8a5a44",
  F: "#5b7b8c",
};

// Default weights (points, sum 100) — matches the PRD default blend.
export const DEFAULT_WEIGHTS: Weights = { D: 30, G: 25, P: 20, E: 15, C: 5, F: 5 };

export const CONSTITUENCY = {
  name: "Nawada",
  state: "Bihar",
  mp: "Office of the Hon'ble MP",
  voices: 42318,
  themes: 180,
  areas: 310,
  verifiedPct: 61,
};

export type Work = {
  id: string;
  title: string;
  category: string;
  area: string;
  source: "citizen" | "plan";
  demand: number; // unique citizens behind it
  factors: Factors;
  evidence: string[];
  rationale: string;
  quotes: string[];
};

export const WORKS: Work[] = [
  {
    id: "w-school-w7",
    title: "Upgrade Govt. Senior Secondary School, Ward 7",
    category: "Education",
    area: "Akbarpur",
    source: "citizen",
    demand: 412,
    factors: { D: 0.9, G: 0.88, P: 0.7, E: 0.82, C: 0.9, F: 0.6 },
    evidence: [
      "412 unique citizens in the last 90 days",
      "Nearest senior-secondary school 6.2 km away (UDISE)",
      "Local enrolment ratio 0.58; dropout 14%",
      "38% SC/ST population, literacy 61% (Census)",
    ],
    rationale:
      "412 citizens across Ward 7 and adjoining tolas asked to upgrade the secondary school. UDISE confirms the nearest senior-secondary is 6.2 km away and enrolment has fallen to 58%. With a 38% SC/ST population and below-average literacy, the measured service gap and the equity case both reinforce the demand — no competing deficit outranks it here.",
    quotes: [
      "Our daughters stop studying after class 8 — the nearest school is too far.",
      "The building has no rooms for higher classes; children sit outside.",
    ],
  },
  {
    id: "w-road-rajauli",
    title: "Repair & metal the Rajauli–Akbarpur road",
    category: "Roads & transport",
    area: "Rajauli",
    source: "citizen",
    demand: 507,
    factors: { D: 0.96, G: 0.8, P: 0.85, E: 0.6, C: 0.85, F: 0.55 },
    evidence: [
      "507 unique citizens; the single most-raised need",
      "Road floods 4 months/year (IMD rainfall + drainage gap)",
      "Serves ~28,000 people across 9 villages (Census)",
      "Only all-weather link to the block hospital",
    ],
    rationale:
      "The most-demanded work in the constituency: 507 citizens report the Rajauli–Akbarpur road becomes impassable through the monsoon. It is the only all-weather link to the block hospital for nine villages (~28,000 people), so population impact is high. Rainfall data corroborates the flooding.",
    quotes: [
      "In the rains an ambulance simply cannot get through.",
      "We lose a full day's wages going the long way around.",
    ],
  },
  {
    id: "w-water-meskaur",
    title: "Piped drinking water, Meskaur cluster",
    category: "Water & sanitation",
    area: "Meskaur",
    source: "citizen",
    demand: 356,
    factors: { D: 0.84, G: 0.9, P: 0.72, E: 0.78, C: 0.8, F: 0.5 },
    evidence: [
      "356 unique citizens",
      "Tap coverage 22%; groundwater over-exploited (CGWB)",
      "Women walk 1.8 km average for water",
      "SC-majority habitations underserved (Census)",
    ],
    rationale:
      "356 citizens in the Meskaur cluster report acute water stress. CGWB classes the block as over-exploited and tap coverage is only 22%, giving the largest service gap of any work. The burden falls on SC-majority habitations, so the equity weight lifts it further.",
    quotes: [
      "We wait hours at the one working handpump.",
      "The borewell has run dry three summers in a row.",
    ],
  },
  {
    id: "w-health-kauakol",
    title: "New Primary Health Sub-centre, Kauakol",
    category: "Health",
    area: "Kauakol",
    source: "citizen",
    demand: 243,
    factors: { D: 0.7, G: 0.75, P: 0.6, E: 0.7, C: 0.7, F: 0.6 },
    evidence: [
      "243 unique citizens",
      "Nearest PHC 11 km away (facility data)",
      "Full immunisation 64% vs 78% district avg (NFHS)",
      "High maternal-care travel burden",
    ],
    rationale:
      "243 citizens want a sub-centre in Kauakol, where the nearest PHC is 11 km away. NFHS shows immunisation lagging the district average, corroborating the demand with a measurable health gap.",
    quotes: ["Pregnant women travel 11 km for a check-up.", "By the time we reach the PHC, it's often closed."],
  },
  {
    id: "w-flood-sakri",
    title: "Flood-protection embankment, Sakri river",
    category: "Roads & transport",
    area: "Warisaliganj",
    source: "citizen",
    demand: 198,
    factors: { D: 0.6, G: 0.82, P: 0.65, E: 0.55, C: 0.75, F: 0.4 },
    evidence: [
      "198 unique citizens (seasonal spikes)",
      "Recurrent crop loss; IMD flags high flood risk",
      "Protects ~14,000 people & farmland",
    ],
    rationale:
      "Seasonal but severe: 198 citizens report the Sakri river flooding farmland and homes. IMD flood-risk data corroborates the need, though feasibility is lower given the engineering cost.",
    quotes: ["Every monsoon we lose the standing crop.", "Water enters homes in the low-lying tola."],
  },
  {
    id: "w-anganwadi-hisua",
    title: "Anganwadi & nutrition centre, Hisua",
    category: "Health",
    area: "Hisua",
    source: "plan",
    demand: 121,
    factors: { D: 0.55, G: 0.6, P: 0.6, E: 0.65, C: 0.6, F: 0.7 },
    evidence: [
      "121 unique citizens + proposed in dev. plan",
      "Child malnutrition above district average (NFHS)",
      "No functional anganwadi in 3 wards",
    ],
    rationale:
      "A dev-plan proposal that also has citizen backing: NFHS shows above-average child malnutrition and three wards lack a functioning anganwadi. Moderate demand but a solid, feasible intervention.",
    quotes: ["The nearest anganwadi shut down last year."],
  },
  {
    id: "w-vocational-hq",
    title: "New Vocational Training Centre, Block HQ",
    category: "Education",
    area: "Nawada town",
    source: "plan",
    demand: 74,
    factors: { D: 0.45, G: 0.5, P: 0.6, E: 0.5, C: 0.4, F: 0.8 },
    evidence: [
      "74 unique citizens; primarily a dev-plan proposal",
      "No skilling gap data confirming acute need",
      "Would serve town + nearby blocks",
    ],
    rationale:
      "Proposed in the development plan. Citizen demand is modest (74) and public data shows no acute skilling deficit relative to the education gap in Ward 7 — so despite high feasibility, it ranks below the school upgrade it competes with.",
    quotes: ["A skills centre would help, but the school comes first for our children."],
  },
  {
    id: "w-solar-warisaliganj",
    title: "Solar street lighting, Warisaliganj market",
    category: "Electricity",
    area: "Warisaliganj",
    source: "plan",
    demand: 63,
    factors: { D: 0.4, G: 0.35, P: 0.55, E: 0.45, C: 0.35, F: 0.85 },
    evidence: ["63 unique citizens", "Grid coverage already 89%", "Cheap, quick to deliver"],
    rationale:
      "A quick, cheap dev-plan item. Feasibility is high, but with 89% grid coverage the service gap is small and demand is low, so it sits near the bottom under the default weights.",
    quotes: ["The market is unsafe after dark."],
  },
];

export type HotspotArea = { name: string; demand: number; top: string };

// Demand intensity 0..1 per block/ward — stands in for the Google Maps heatmap.
export const HOTSPOTS: HotspotArea[] = [
  { name: "Rajauli", demand: 0.96, top: "Roads" },
  { name: "Meskaur", demand: 0.9, top: "Water" },
  { name: "Akbarpur", demand: 0.88, top: "Education" },
  { name: "Kauakol", demand: 0.74, top: "Health" },
  { name: "Warisaliganj", demand: 0.68, top: "Roads" },
  { name: "Pakribarawan", demand: 0.62, top: "Water" },
  { name: "Hisua", demand: 0.58, top: "Health" },
  { name: "Sirdala", demand: 0.55, top: "Water" },
  { name: "Nawada town", demand: 0.5, top: "Electricity" },
  { name: "Nardiganj", demand: 0.47, top: "Education" },
  { name: "Gobindpur", demand: 0.44, top: "Roads" },
  { name: "Roh", demand: 0.4, top: "Health" },
  { name: "Kashichak", demand: 0.36, top: "Water" },
  { name: "Narhat", demand: 0.31, top: "Roads" },
];

export type Theme = { category: string; count: number; tone: string };

export const THEMES: Theme[] = [
  { category: "Roads & transport", count: 9840, tone: "var(--color-marigold)" },
  { category: "Water & sanitation", count: 7620, tone: "var(--color-terracotta)" },
  { category: "Education", count: 5210, tone: "var(--color-indigo)" },
  { category: "Health", count: 4130, tone: "var(--color-sage)" },
  { category: "Electricity", count: 3020, tone: "#8a5a44" },
  { category: "Livelihood", count: 2450, tone: "#5b7b8c" },
  { category: "Other", count: 1180, tone: "#9a8f78" },
];

/** Weighted-sum ranking score (0–100). Weights are normalised so any
 *  slider combination keeps the score on the same scale. */
export function scoreWork(f: Factors, w: Weights): number {
  const sum = w.D + w.G + w.P + w.E + w.C + w.F || 1;
  const s = (w.D * f.D + w.G * f.G + w.P * f.P + w.E * f.E + w.C * f.C + w.F * f.F) / sum;
  return Math.round(s * 100);
}

export function confidence(f: Factors): "high" | "medium" | "low" {
  const c = 0.6 * f.C + 0.4 * f.D;
  return c >= 0.66 ? "high" : c >= 0.42 ? "medium" : "low";
}
