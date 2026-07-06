import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";

/* ------------------------------------------------------------------
   GET /api/rankings

   Returns the latest ranking snapshot for the MP dashboard. If Firestore
   isn't configured, or no snapshot has been computed yet, returns
   { source: "empty" } and the dashboard renders its built-in seed data —
   so the demo screen is never blank.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ source: "empty", reason: "no-db" });

  try {
    const doc = await db.collection("rankings").doc("latest").get();
    if (!doc.exists) return NextResponse.json({ source: "empty", reason: "not-computed" });
    const data = doc.data()!;
    if (!Array.isArray(data.works) || data.works.length === 0) {
      return NextResponse.json({ source: "empty", reason: "no-works" });
    }
    return NextResponse.json({ source: "live", ...data });
  } catch (err) {
    console.warn("[rankings] read failed:", (err as Error).message);
    return NextResponse.json({ source: "empty", reason: "error" });
  }
}
