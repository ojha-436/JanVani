/* ------------------------------------------------------------------
   Feasibility & cost estimate — shared type + deterministic fallback.

   An estimate is an EARLY-PRIORITISATION aid, NOT a tender/quotation. It
   is either produced by Gemini (grounded in typical Indian govt
   Schedule-of-Rates ranges) or, when AI is off/unavailable, by the
   category-band fallback below so the feature still works. Designed so
   the MP can later accept it to set a work's Feasibility (F) factor.
   ------------------------------------------------------------------ */

export type CostEstimate = {
  scope: string; // one line: what the work entails
  eligibility: { mplads: boolean; note: string }; // is it MP/MPLADS-fundable
  boq: { item: string; qty: string; note?: string }[]; // bill of quantities
  costLow: number; // INR
  costHigh: number; // INR
  timelineWeeks: { low: number; high: number };
  risks: string[];
  assumptions: string[];
  confidence: "low" | "medium" | "high";
  source: "ai" | "fallback"; // ai = Gemini; fallback = category band
  generatedAt: string;
};

/** Rough INR bands + delivery time per category, for the fallback and as a
 *  sanity clamp on the AI output. Realistic rural/small-town ballparks. */
const CATEGORY_BAND: Record<string, { low: number; high: number; weeks: [number, number] }> = {
  "Roads & transport": { low: 800_000, high: 6_000_000, weeks: [6, 24] },
  "Water & sanitation": { low: 300_000, high: 8_000_000, weeks: [4, 20] },
  Education: { low: 800_000, high: 4_000_000, weeks: [8, 28] },
  Health: { low: 1_500_000, high: 7_000_000, weeks: [10, 32] },
  Electricity: { low: 300_000, high: 2_000_000, weeks: [3, 12] },
  Livelihood: { low: 1_000_000, high: 4_500_000, weeks: [8, 24] },
  Other: { low: 500_000, high: 3_000_000, weeks: [4, 16] },
};

export function categoryBand(category: string) {
  return CATEGORY_BAND[category] ?? CATEGORY_BAND.Other;
}

/** Deterministic estimate when Gemini is unavailable. Honest, category-level. */
export function fallbackEstimate(input: { category: string; need?: string; area?: string }, nowIso: string): CostEstimate {
  const band = categoryBand(input.category);
  return {
    scope: `${input.category} works${input.area ? ` in ${input.area}` : ""} — indicative scope pending a site assessment.`,
    eligibility: {
      mplads: input.category !== "Other",
      note:
        input.category === "Other"
          ? "Check MPLADS eligibility — durable community assets qualify; recurring costs and individual benefits do not."
          : "Durable community asset — typically MPLADS-eligible; confirm against current guidelines.",
    },
    boq: [
      { item: "Civil works & materials (category-typical)", qty: "as assessed on site" },
      { item: "Labour, transport & contingency", qty: "~15–20% of works" },
    ],
    costLow: band.low,
    costHigh: band.high,
    timelineWeeks: { low: band.weeks[0], high: band.weeks[1] },
    risks: ["Estimate is category-level, not site-surveyed", "Land availability / clearances not verified", "Monsoon window may affect execution"],
    assumptions: ["No live Schedule-of-Rates lookup applied", "Scope inferred from the category, not detailed measurement"],
    confidence: "low",
    source: "fallback",
    generatedAt: nowIso,
  };
}

/** Compact INR: ₹1.2 Cr / ₹4.8 L / ₹12,000. */
export function formatINR(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
