import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { computeRanking, type SubmissionRow } from "@/lib/ranking";
import { confidence } from "@/lib/dashboardData";
import { rationaleFor } from "@/lib/ai";

/* ------------------------------------------------------------------
   POST /api/recompute

   The batch analysis + ranking job (ARCHITECTURE.md §10). Reads every
   submission from Firestore, clusters them into demand themes, runs the
   6-factor ranking engine, generates a grounded "why this rank"
   rationale for the top works (Gemini), and writes the snapshot to
   `rankings/latest`. In the full design this is triggered by Cloud
   Scheduler on a nightly / threshold cadence; here it is an idempotent
   endpoint you (or a scheduler) can hit any time.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOP_N_RATIONALE = 8;

export async function POST() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, reason: "no-db", note: "Firestore not configured (demo mode)." }, { status: 200 });
  }

  try {
    const snap = await db.collection("submissions").get();
    const subs: SubmissionRow[] = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        createdAt: String(x.createdAt ?? new Date().toISOString()),
        citizenKey: String(x.citizenKey ?? d.id),
        category: String(x.category ?? "Other"),
        need_en: String(x.need_en ?? ""),
        urgency: typeof x.urgency === "number" ? x.urgency : 0.6,
        area: String(x.area ?? ""),
        locale: String(x.locale ?? "en"),
        anonymous: Boolean(x.anonymous ?? true),
      };
    });

    const result = computeRanking(subs, new Date().toISOString());

    // Enrich the top works with a grounded rationale; the rest get a
    // deterministic template (rationaleFor falls back when AI is off).
    await Promise.all(
      result.works.slice(0, TOP_N_RATIONALE).map(async (w) => {
        w.rationale = await rationaleFor({
          title: w.title,
          score: Math.round(
            100 * (0.3 * w.factors.D + 0.25 * w.factors.G + 0.2 * w.factors.P + 0.15 * w.factors.E + 0.05 * w.factors.C + 0.05 * w.factors.F)
          ),
          demand: w.demand,
          evidence: w.evidence,
          confidence: confidence(w.factors),
        });
      })
    );
    for (const w of result.works.slice(TOP_N_RATIONALE)) {
      if (!w.rationale) w.rationale = `${w.demand} unique citizens; ${w.evidence.slice(0, 2).join("; ")}.`;
    }

    await db.collection("rankings").doc("latest").set(result);

    return NextResponse.json({ ok: true, submissions: subs.length, works: result.works.length, generatedAt: result.generatedAt });
  } catch (err) {
    console.error("recompute error", err);
    return NextResponse.json({ ok: false, error: "Recompute failed" }, { status: 500 });
  }
}
