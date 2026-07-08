import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import type { MpAllocation } from "@/lib/mp";

/* ------------------------------------------------------------------
   MP allocation lookup — public (no admin key), read-only-ish.

   GET  /api/mp/resolve?token=...  → preview an invite (activation page).
   GET  /api/mp/resolve?email=...  → resolve constituency for a returning
        MP at sign-in (so the MP can't self-assign a constituency).
   POST /api/mp/resolve { token }  → mark the invite active (first entry).

   Returns only the non-sensitive allocation fields.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicView(rec: MpAllocation) {
  return { email: rec.email, name: rec.name, constituency: rec.constituency, status: rec.status };
}

export async function GET(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, reason: "no-db" });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  try {
    if (token) {
      const doc = await db.collection("mpAccounts").doc(token).get();
      if (!doc.exists) return NextResponse.json({ ok: false, error: "invite-not-found" }, { status: 404 });
      const rec = doc.data() as MpAllocation;
      if (rec.status === "revoked") return NextResponse.json({ ok: false, error: "revoked" }, { status: 403 });
      return NextResponse.json({ ok: true, ...publicView(rec) });
    }
    if (email) {
      const snap = await db.collection("mpAccounts").where("email", "==", email.trim().toLowerCase()).limit(1).get();
      if (snap.empty) return NextResponse.json({ ok: false, error: "not-allocated" }, { status: 404 });
      const rec = snap.docs[0].data() as MpAllocation;
      if (rec.status === "revoked") return NextResponse.json({ ok: false, error: "revoked" }, { status: 403 });
      return NextResponse.json({ ok: true, ...publicView(rec) });
    }
    return NextResponse.json({ ok: false, error: "token or email required" }, { status: 400 });
  } catch (err) {
    console.warn("[mp/resolve] failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "lookup-failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, reason: "no-db" });

  let token = "";
  try {
    token = String((await req.json()).token ?? "").trim();
  } catch {
    /* ignore */
  }
  if (!token) return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });

  try {
    const ref = db.collection("mpAccounts").doc(token);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ ok: false, error: "invite-not-found" }, { status: 404 });
    const rec = doc.data() as MpAllocation;
    if (rec.status === "revoked") return NextResponse.json({ ok: false, error: "revoked" }, { status: 403 });
    if (rec.status !== "active") {
      await ref.set({ status: "active", activatedAt: new Date().toISOString() }, { merge: true });
    }
    return NextResponse.json({ ok: true, ...publicView(rec), status: "active" });
  } catch (err) {
    console.error("[mp/resolve] activate failed", err);
    return NextResponse.json({ ok: false, error: "activate-failed" }, { status: 500 });
  }
}
