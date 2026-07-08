import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/firebaseAdmin";
import { inviteLink, type MpAllocation } from "@/lib/mp";
import { resolveConstituency } from "@/lib/constituencies";

/* ------------------------------------------------------------------
   MP provisioning (admin only).

   POST /api/mp  { adminKey, email, name, constituency }
        → creates an mpAccounts record + a one-time invite link. No shared
          passwords: the admin allocates a constituency to an email and
          sends the returned link.
   GET  /api/mp?adminKey=...  → list all allocations for the console.

   Gated by a single server-side admin key (MP_ADMIN_KEY). This is a
   pragmatic gate for the pilot; production replaces it with a real
   super-admin role on a verified Firebase Auth identity.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_KEY = process.env.MP_ADMIN_KEY || "janvaani-admin-2026";

function authed(key: string | null): boolean {
  return Boolean(key) && key === ADMIN_KEY;
}

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, reason: "no-db", note: "Provisioning needs the live database." }, { status: 200 });

  let body: { adminKey?: string; email?: string; name?: string; constituency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  if (!authed(body.adminKey ?? null)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  // Constituency must be an official one, so a voice picked on the same list
  // routes to this MP. Store the canonical name.
  const resolved = resolveConstituency(String(body.constituency ?? ""));
  if (!resolved) return NextResponse.json({ ok: false, error: "Unknown constituency — pick an official Lok Sabha constituency." }, { status: 400 });
  const constituency = resolved.name;

  const inviteToken = randomUUID().replace(/-/g, "");
  const rec: MpAllocation = {
    inviteToken,
    email,
    name,
    constituency,
    status: "invited",
    createdAt: new Date().toISOString(),
    activatedAt: null,
  };
  try {
    // One active allocation per email: clear any prior invites for it.
    const prior = await db.collection("mpAccounts").where("email", "==", email).get();
    const batch = db.batch();
    prior.forEach((d) => batch.delete(d.ref));
    batch.set(db.collection("mpAccounts").doc(inviteToken), rec);
    await batch.commit();
    return NextResponse.json({ ok: true, inviteToken, link: inviteLink(inviteToken), email, constituency });
  } catch (err) {
    console.error("mp provision error", err);
    return NextResponse.json({ ok: false, error: "Could not create allocation." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, reason: "no-db", items: [] });

  const key = new URL(req.url).searchParams.get("adminKey");
  if (!authed(key)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  try {
    const snap = await db.collection("mpAccounts").get();
    const items = snap.docs
      .map((d) => d.data() as MpAllocation)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.warn("[mp] list failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "List failed.", items: [] });
  }
}

/* Deactivate / reactivate an MP's access (admin). A revoked account can no
   longer resolve at sign-in or activation, so it loses dashboard access. */
export async function PATCH(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, reason: "no-db" }, { status: 200 });

  let body: { adminKey?: string; token?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  if (!authed(body.adminKey ?? null)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const token = String(body.token ?? "").trim();
  const action = body.action === "reactivate" ? "reactivate" : body.action === "deactivate" ? "deactivate" : null;
  if (!token || !action) return NextResponse.json({ ok: false, error: "token and action (deactivate|reactivate) required." }, { status: 400 });

  try {
    const ref = db.collection("mpAccounts").doc(token);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    const rec = doc.data() as MpAllocation;

    if (action === "deactivate") {
      await ref.set({ status: "revoked", revokedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ ok: true, status: "revoked" });
    }
    // reactivate → back to active if they'd signed in, else invited
    const status = rec.activatedAt ? "active" : "invited";
    await ref.set({ status, revokedAt: null }, { merge: true });
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("[mp] status change failed", err);
    return NextResponse.json({ ok: false, error: "Could not update access." }, { status: 500 });
  }
}
