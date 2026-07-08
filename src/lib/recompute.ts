import type { Firestore } from "firebase-admin/firestore";
import { computeRanking, type SubmissionRow } from "./ranking";
import { confidence, scoreWork, DEFAULT_WEIGHTS } from "./dashboardData";
import { rationaleFor } from "./ai";

/* ------------------------------------------------------------------
   Shared ranking recompute, used by:
   - POST /api/recompute (admin/scheduler trigger, full Gemini rationale)
   - POST /api/submissions (fired after every write, so the dashboard's
     counts/hotspots/works never sit stale until someone remembers to hit
     recompute by hand — the numbers matter immediately, the Gemini prose
     can catch up on the next full recompute)
   ------------------------------------------------------------------ */

const TOP_N_RATIONALE = 8;

export async function recomputeAndStore(db: Firestore, opts: { withRationale: boolean }) {
  const snap = await db.collection("submissions").get();
  const subs: SubmissionRow[] = snap.docs.map((d) => {
    const x = d.data();
    const coords =
      x.coords && typeof x.coords.lat === "number" && typeof x.coords.lng === "number"
        ? { lat: x.coords.lat, lng: x.coords.lng }
        : null;
    return {
      id: d.id,
      createdAt: String(x.createdAt ?? new Date().toISOString()),
      citizenKey: String(x.citizenKey ?? d.id),
      category: String(x.category ?? "Other"),
      need_en: String(x.need_en ?? ""),
      urgency: typeof x.urgency === "number" ? x.urgency : 0.6,
      area: String(x.area ?? ""),
      coords,
      locale: String(x.locale ?? "en"),
      anonymous: Boolean(x.anonymous ?? true),
    };
  });

  const result = computeRanking(subs, new Date().toISOString());

  if (opts.withRationale) {
    // Enrich the top works with a grounded Gemini rationale; the rest get a
    // deterministic template (rationaleFor falls back when AI is off).
    await Promise.all(
      result.works.slice(0, TOP_N_RATIONALE).map(async (w) => {
        w.rationale = await rationaleFor({
          title: w.title,
          score: scoreWork(w.factors, DEFAULT_WEIGHTS),
          demand: w.demand,
          evidence: w.evidence,
          confidence: confidence(w.factors),
        });
      })
    );
    for (const w of result.works.slice(TOP_N_RATIONALE)) {
      if (!w.rationale) w.rationale = `${w.demand} unique citizens; ${w.evidence.slice(0, 2).join("; ")}.`;
    }
  } else {
    // Fast path: numbers/hotspots/works must be correct right away; skip the
    // per-work Gemini calls (cost + latency) and use the deterministic
    // template everywhere. A later full recompute fills in the AI prose.
    for (const w of result.works) {
      w.rationale = `${w.demand} unique citizens; ${w.evidence.slice(0, 2).join("; ")}.`;
    }
  }

  await db.collection("rankings").doc("latest").set(result);
  return { submissions: subs.length, works: result.works.length, generatedAt: result.generatedAt };
}
