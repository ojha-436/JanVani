/* ------------------------------------------------------------------
   Individual-submission data for the dashboard's demand map and the
   recurring-needs drill-down.

   `PublicSubmission` is the safe, dashboard-facing shape (no PII beyond a
   voluntarily-verified name). `sampleSubmissions()` synthesises a
   deterministic, realistic set for demo mode so the map and drill-down
   are fully interactive without a live database; the same shape is
   produced from Firestore when the backend is live.
   ------------------------------------------------------------------ */

import { AREAS, areaCentroid, serviceGap, topDataDeficit, type Category } from "./publicData";

export type PublicSubmission = {
  id: string;
  category: string;
  area: string;
  need_en: string;
  coords: { lat: number; lng: number };
  createdAt: string; // ISO
  anonymous: boolean;
  verified: boolean; // Aadhaar-verified submission
  submitter: string; // "Anonymous citizen" or the verified name
  locale: string;
  urgency: number; // 0..1
  hasPhoto: boolean;
  hasAudio: boolean;
  location: string;
};

/** Category → brand colour CSS var (for in-DOM SVG that inherits theme tokens). */
export const CATEGORY_COLOR: Record<string, string> = {
  "Roads & transport": "var(--color-marigold)",
  "Water & sanitation": "var(--color-terracotta)",
  Education: "var(--color-indigo)",
  Health: "var(--color-sage)",
  Electricity: "#8a5a44",
  Livelihood: "#5b7b8c",
  Other: "#9a8f78",
};

/** Category → resolved hex (for Google Maps marker icons, which can't use CSS vars). */
export const CATEGORY_HEX: Record<string, string> = {
  "Roads & transport": "#e39a1c",
  "Water & sanitation": "#b64a34",
  Education: "#263a63",
  Health: "#4f6f60",
  Electricity: "#8a5a44",
  Livelihood: "#5b7b8c",
  Other: "#9a8f78",
};

export const categoryHex = (c: string) => CATEGORY_HEX[c] ?? "#e39a1c";

export const CATEGORY_ORDER: Category[] = [
  "Roads & transport",
  "Water & sanitation",
  "Education",
  "Health",
  "Electricity",
  "Livelihood",
];

/* ---------------- deterministic PRNG (stable demo) ---------------- */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LANG_LABEL: Record<string, string> = { hi: "Hindi", en: "English", ta: "Tamil", mr: "Marathi", bn: "Bengali" };
export const localeLabel = (l: string) => LANG_LABEL[l] ?? l;

const NAMES = [
  "Aarti Sharma", "Ramesh Yadav", "Sunita Devi", "Mohd Imran", "Priya Kumari",
  "Rajesh Paswan", "Fatima Khatun", "Suresh Prasad", "Anjali Verma", "Vikash Kumar",
  "Geeta Kumari", "Md Shahid", "Kavita Devi", "Deepak Ravidas", "Neha Gupta", "Manoj Singh",
];

const NEEDS: Record<string, string[]> = {
  "Roads & transport": [
    "The village road floods every monsoon and becomes impassable.",
    "Ambulances cannot reach us when the road is waterlogged.",
    "We lose a day's wages taking the long detour to the block.",
    "The culvert has collapsed and no vehicle can cross.",
  ],
  "Water & sanitation": [
    "The handpump runs dry every summer and we walk far for water.",
    "There is no piped water supply in our tola.",
    "We queue for hours at the one working borewell.",
    "Drinking water is contaminated after the rains.",
  ],
  Education: [
    "The nearest senior secondary school is too far for our daughters.",
    "Our school has no rooms for the higher classes.",
    "Children drop out after class 8 because of the distance.",
    "There are not enough teachers for the middle school.",
  ],
  Health: [
    "Pregnant women travel over 10 km for a check-up.",
    "The sub-centre is often closed when we reach it.",
    "We need a health facility closer to the village.",
    "Immunisation camps rarely reach our habitation.",
  ],
  Electricity: [
    "Power cuts leave the market unsafe after dark.",
    "Voltage is too low to run irrigation pumps.",
    "Street lights have not worked for months.",
    "Frequent outages damage our appliances.",
  ],
  Livelihood: [
    "Young people here have nowhere to learn a trade.",
    "A skills centre would help us find work locally.",
    "We need support for the local weavers' collective.",
    "Migration is high because there are no local jobs.",
  ],
  Other: ["This local issue affects our daily lives and needs attention."],
};

function pick<T>(arr: T[], r: number): T {
  return arr[Math.floor(r * arr.length) % arr.length];
}

/** Deterministic set of ~100 realistic submissions across the constituency. */
export function sampleSubmissions(nowIso: string = new Date().toISOString()): PublicSubmission[] {
  const rng = mulberry32(20260706);
  const nowMs = Date.parse(nowIso) || Date.now();
  const out: PublicSubmission[] = [];

  AREAS.forEach((area, ai) => {
    const centroid = areaCentroid(area.name);
    const top = topDataDeficit(area);

    CATEGORY_ORDER.forEach((cat, ci) => {
      const g = serviceGap(cat, area);
      let n = 0;
      if (cat === top) n = 4 + Math.round(g * 6);
      else if (g > 0.5) n = 2 + Math.round(g * 4);
      else if (rng() > 0.6) n = 1 + Math.round(rng() * 2);

      for (let i = 0; i < n; i++) {
        const r = rng();
        const anonymous = rng() > 0.42; // ~58% anonymous
        const locale = pick(["hi", "hi", "en", "hi", "bn"], rng());
        const ageDays = Math.floor(rng() * 90);
        out.push({
          id: `s_${ai}_${ci}_${i}`,
          category: cat,
          area: area.name,
          need_en: pick(NEEDS[cat] ?? NEEDS.Other, r),
          coords: {
            lat: centroid.lat + (rng() - 0.5) * 0.045,
            lng: centroid.lng + (rng() - 0.5) * 0.05,
          },
          createdAt: new Date(nowMs - ageDays * 86_400_000).toISOString(),
          anonymous,
          verified: !anonymous,
          submitter: anonymous ? "Anonymous citizen" : pick(NAMES, rng()),
          locale,
          urgency: 0.5 + rng() * 0.5,
          hasPhoto: rng() > 0.7,
          hasAudio: rng() > 0.45,
          location: `${area.name}, Nawada, Bihar`,
        });
      }
    });
  });

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
