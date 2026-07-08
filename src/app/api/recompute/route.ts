import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { recomputeAndStore } from "@/lib/recompute";
import { rateLimit, clientKey } from "@/lib/security/rateLimit";

/* ------------------------------------------------------------------
   POST /api/recompute

   The batch analysis + ranking job (ARCHITECTURE.md §10). Reads every
   submission from Firestore, clusters them into demand themes, runs the
   6-factor ranking engine, generates a grounded "why this rank"
   rationale for the top works (Gemini), and writes the snapshot to
   `rankings/latest`. In the full design this is triggered by Cloud
   Scheduler on a nightly / threshold cadence; here it is an idempotent
   endpoint you (or a scheduler) can hit any time. POST /api/submissions
   also triggers a cheaper version of this (no Gemini rationale) after
   every new submission, so counts/hotspots never wait on this endpoint.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Expensive (full recluster + rank + Gemini rationale) — cap per client.
  const rl = rateLimit(clientKey(req, "recompute"), 20, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many recompute requests — try again shortly." }, { status: 429 });

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, reason: "no-db", note: "Firestore not configured (demo mode)." }, { status: 200 });
  }

  try {
    const result = await recomputeAndStore(db, { withRationale: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("recompute error", err);
    return NextResponse.json({ ok: false, error: "Recompute failed" }, { status: 500 });
  }
}
