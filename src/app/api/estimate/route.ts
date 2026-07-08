import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { estimateFeasibility } from "@/lib/ai";
import { fallbackEstimate, type CostEstimate } from "@/lib/estimate";

/* ------------------------------------------------------------------
   POST /api/estimate  { submissionId?, need, category, area, constituency?, refresh? }

   The MP-triggered feasibility & cost agent. Drafts a structured estimate
   (scope, MPLADS eligibility, bill of quantities, cost band, timeline,
   risks, confidence) via Gemini, falling back to a deterministic
   category-band estimate when AI is off or errors. Cached per submission
   in `estimates/{id}` so re-opening a voice doesn't re-bill Gemini; pass
   refresh:true to recompute.

   This is an early-prioritisation aid, NOT a tender/quotation — the UI
   labels it as such. Its output is shaped to later set a work's
   Feasibility (F) factor once the MP accepts it.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { submissionId?: string; need?: string; category?: string; area?: string; constituency?: string; refresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const need = String(body.need ?? "").trim();
  const category = String(body.category ?? "Other").trim() || "Other";
  const area = String(body.area ?? "").trim();
  const constituency = String(body.constituency ?? "").trim() || undefined;
  const submissionId = String(body.submissionId ?? "").trim();
  if (!need) return NextResponse.json({ ok: false, error: "A citizen need is required to estimate." }, { status: 400 });

  const db = getDb();

  // Serve a cached estimate if we have one (unless a refresh is requested).
  if (db && submissionId && !body.refresh) {
    try {
      const cached = await db.collection("estimates").doc(submissionId).get();
      if (cached.exists) return NextResponse.json({ ok: true, cached: true, estimate: cached.data() as CostEstimate });
    } catch {
      /* fall through to compute */
    }
  }

  const ai = await estimateFeasibility({ need, category, area, constituency });
  const estimate: CostEstimate = ai ?? fallbackEstimate({ category, need, area }, new Date().toISOString());

  if (db && submissionId) {
    try {
      await db.collection("estimates").doc(submissionId).set(estimate);
    } catch {
      /* cache write is best-effort */
    }
  }

  return NextResponse.json({ ok: true, cached: false, estimate });
}
