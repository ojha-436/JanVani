/* ------------------------------------------------------------------
   Public-dataset snapshot (the "objectivity layer" of the ranking
   engine). In the full architecture these are BigQuery dimension tables
   loaded from Census/NFHS, UDISE, CGWB, CPCB and IMD (see
   docs/ARCHITECTURE.md §4). Here they are a realistic hard-coded
   snapshot for one constituency so the 6-factor score can be computed
   server-side from real citizen submissions without standing up BigQuery.

   Every number below stands in for a public-data value and is what makes
   "school upgrade vs vocational centre" objective: each candidate work is
   scored against the *measured deficit* in its own domain.
   ------------------------------------------------------------------ */

export const CONSTITUENCY_META = {
  id: "nawada",
  name: "Nawada",
  state: "Bihar",
  mp: "Office of the Hon'ble MP",
};

export type Category =
  | "Roads & transport"
  | "Water & sanitation"
  | "Education"
  | "Health"
  | "Electricity"
  | "Livelihood"
  | "Other";

export type AreaData = {
  name: string;
  population: number; // Census
  pop_0_14: number; // child population (Census) — beneficiary base for schools
  working_age: number; // 15–59 — beneficiary base for livelihood
  sc_st_pct: number; // 0..1 (Census)
  bpl_pct: number; // 0..1 (NFHS/SECC)
  literacy_pct: number; // 0..1 (Census)
  // Category service-gap signals (higher signal = worse service):
  education: { enrolment_ratio: number; nearest_secondary_km: number; dropout_rate: number };
  water: { tap_coverage_pct: number; groundwater_stress: number };
  health: { nearest_phc_km: number; immunization_pct: number };
  roads: { connectivity: number; flood_risk: number }; // connectivity higher=better
  electricity: { grid_coverage: number };
  livelihood: { unemployment: number };
};

export const AREAS: AreaData[] = [
  {
    name: "Rajauli",
    population: 28400, pop_0_14: 9800, working_age: 16200, sc_st_pct: 0.34, bpl_pct: 0.41, literacy_pct: 0.59,
    education: { enrolment_ratio: 0.71, nearest_secondary_km: 4.1, dropout_rate: 0.11 },
    water: { tap_coverage_pct: 0.44, groundwater_stress: 0.5 },
    health: { nearest_phc_km: 7.5, immunization_pct: 0.68 },
    roads: { connectivity: 0.38, flood_risk: 0.82 },
    electricity: { grid_coverage: 0.86 },
    livelihood: { unemployment: 0.28 },
  },
  {
    name: "Meskaur",
    population: 19100, pop_0_14: 6300, working_age: 11000, sc_st_pct: 0.52, bpl_pct: 0.47, literacy_pct: 0.54,
    education: { enrolment_ratio: 0.74, nearest_secondary_km: 3.4, dropout_rate: 0.1 },
    water: { tap_coverage_pct: 0.22, groundwater_stress: 0.88 },
    health: { nearest_phc_km: 6.2, immunization_pct: 0.66 },
    roads: { connectivity: 0.52, flood_risk: 0.4 },
    electricity: { grid_coverage: 0.82 },
    livelihood: { unemployment: 0.31 },
  },
  {
    name: "Akbarpur",
    population: 24200, pop_0_14: 8600, working_age: 13800, sc_st_pct: 0.38, bpl_pct: 0.36, literacy_pct: 0.61,
    education: { enrolment_ratio: 0.58, nearest_secondary_km: 6.2, dropout_rate: 0.14 },
    water: { tap_coverage_pct: 0.55, groundwater_stress: 0.4 },
    health: { nearest_phc_km: 5.0, immunization_pct: 0.72 },
    roads: { connectivity: 0.6, flood_risk: 0.3 },
    electricity: { grid_coverage: 0.9 },
    livelihood: { unemployment: 0.24 },
  },
  {
    name: "Kauakol",
    population: 17800, pop_0_14: 6000, working_age: 10200, sc_st_pct: 0.44, bpl_pct: 0.43, literacy_pct: 0.56,
    education: { enrolment_ratio: 0.7, nearest_secondary_km: 5.0, dropout_rate: 0.12 },
    water: { tap_coverage_pct: 0.48, groundwater_stress: 0.45 },
    health: { nearest_phc_km: 11.0, immunization_pct: 0.64 },
    roads: { connectivity: 0.5, flood_risk: 0.35 },
    electricity: { grid_coverage: 0.8 },
    livelihood: { unemployment: 0.29 },
  },
  {
    name: "Warisaliganj",
    population: 26100, pop_0_14: 8400, working_age: 15100, sc_st_pct: 0.3, bpl_pct: 0.34, literacy_pct: 0.64,
    education: { enrolment_ratio: 0.76, nearest_secondary_km: 3.0, dropout_rate: 0.09 },
    water: { tap_coverage_pct: 0.6, groundwater_stress: 0.35 },
    health: { nearest_phc_km: 4.5, immunization_pct: 0.74 },
    roads: { connectivity: 0.45, flood_risk: 0.7 },
    electricity: { grid_coverage: 0.88 },
    livelihood: { unemployment: 0.26 },
  },
  {
    name: "Hisua",
    population: 22300, pop_0_14: 7400, working_age: 12900, sc_st_pct: 0.33, bpl_pct: 0.38, literacy_pct: 0.62,
    education: { enrolment_ratio: 0.73, nearest_secondary_km: 3.6, dropout_rate: 0.1 },
    water: { tap_coverage_pct: 0.57, groundwater_stress: 0.42 },
    health: { nearest_phc_km: 5.5, immunization_pct: 0.63 },
    roads: { connectivity: 0.58, flood_risk: 0.32 },
    electricity: { grid_coverage: 0.87 },
    livelihood: { unemployment: 0.27 },
  },
  {
    name: "Nawada town",
    population: 31500, pop_0_14: 9200, working_age: 19400, sc_st_pct: 0.24, bpl_pct: 0.27, literacy_pct: 0.72,
    education: { enrolment_ratio: 0.84, nearest_secondary_km: 1.5, dropout_rate: 0.07 },
    water: { tap_coverage_pct: 0.71, groundwater_stress: 0.3 },
    health: { nearest_phc_km: 2.5, immunization_pct: 0.8 },
    roads: { connectivity: 0.72, flood_risk: 0.2 },
    electricity: { grid_coverage: 0.94 },
    livelihood: { unemployment: 0.22 },
  },
  {
    name: "Pakribarawan",
    population: 20400, pop_0_14: 6900, working_age: 11800, sc_st_pct: 0.4, bpl_pct: 0.44, literacy_pct: 0.55,
    education: { enrolment_ratio: 0.72, nearest_secondary_km: 4.4, dropout_rate: 0.12 },
    water: { tap_coverage_pct: 0.38, groundwater_stress: 0.6 },
    health: { nearest_phc_km: 6.8, immunization_pct: 0.65 },
    roads: { connectivity: 0.48, flood_risk: 0.45 },
    electricity: { grid_coverage: 0.83 },
    livelihood: { unemployment: 0.3 },
  },
];

export const AREA_NAMES: string[] = AREAS.map((a) => a.name);

const AREA_BY_NAME: Record<string, AreaData> = Object.fromEntries(AREAS.map((a) => [a.name, a]));

/** Look up an area, defaulting to the first (busiest) if unknown. */
export function areaData(name: string): AreaData {
  return AREA_BY_NAME[name] ?? AREAS[0];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Category-specific service gap G ∈ [0,1] — the measured deficit.
 *  See ARCHITECTURE.md §7.2. Higher = worse service = stronger case. */
export function serviceGap(category: Category, a: AreaData): number {
  switch (category) {
    case "Education":
      return clamp01(
        0.4 * (1 - a.education.enrolment_ratio) +
          0.3 * Math.min(a.education.nearest_secondary_km / 8, 1) +
          0.2 * a.education.dropout_rate * 3 +
          0.1 * 0.5
      );
    case "Water & sanitation":
      return clamp01((1 - a.water.tap_coverage_pct) * (0.7 + 0.3 * a.water.groundwater_stress));
    case "Health":
      return clamp01(0.6 * Math.min(a.health.nearest_phc_km / 12, 1) + 0.4 * (1 - a.health.immunization_pct));
    case "Roads & transport":
      return clamp01(0.6 * (1 - a.roads.connectivity) + 0.4 * a.roads.flood_risk);
    case "Electricity":
      return clamp01(1 - a.electricity.grid_coverage);
    case "Livelihood":
      return clamp01(a.livelihood.unemployment * 2);
    default:
      return 0.4;
  }
}

/** Beneficiary population for a category (child pop for schools, working-age
 *  for livelihood, total otherwise). Raw count; normalised in the engine. */
export function beneficiaries(category: Category, a: AreaData): number {
  if (category === "Education") return a.pop_0_14;
  if (category === "Livelihood") return a.working_age;
  return a.population;
}

/** Equity / vulnerability E ∈ [0,1] — see ARCHITECTURE.md §7.4. */
export function equity(a: AreaData): number {
  return clamp01(0.4 * a.sc_st_pct + 0.3 * a.bpl_pct + 0.3 * (1 - a.literacy_pct));
}

/** The single largest measured deficit in an area — used for corroboration
 *  (does the top citizen demand match the top data-derived need?). */
export function topDataDeficit(a: AreaData): Category {
  const cats: Category[] = [
    "Roads & transport",
    "Water & sanitation",
    "Education",
    "Health",
    "Electricity",
    "Livelihood",
  ];
  return cats.reduce((best, c) => (serviceGap(c, a) > serviceGap(best, a) ? c : best), cats[0]);
}

/** Base feasibility F ∈ [0,1] by category (benefit-per-rupee / deliverability). */
export function baseFeasibility(category: Category): number {
  const map: Record<Category, number> = {
    Electricity: 0.85,
    "Water & sanitation": 0.55,
    Education: 0.6,
    Health: 0.6,
    "Roads & transport": 0.55,
    Livelihood: 0.7,
    Other: 0.5,
  };
  return map[category] ?? 0.5;
}
