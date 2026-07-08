import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { WORK_STATUSES, WORKS, type WorkStatusValue } from "@/lib/dashboardData";

/* ------------------------------------------------------------------
   The accountability loop.

   GET  /api/status  → every ranked work joined with its response status
        (Received → Acknowledged → Funds sanctioned → In progress → Done).
        Powers the MP dashboard status controls AND the public, read-only
        "you spoke, we acted" board at /status.
   POST /api/status  → { workId, status, note?, workTitle? } sets a work's
        status (MP action; also used by the assistant's confirmed actions).

   Status lives in its own `workStatus/{workId}` collection, keyed by the
   stable work id, so it survives every ranking recompute.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type StatusItem = {
  id: string;
  title: string;
  category: string;
  area: string;
  demand: number;
  source: string;
  status: WorkStatusValue;
  note?: string;
  updatedAt?: string;
};

/** Demo-mode board: a few works pre-set so the public page looks alive. */
const DEMO_STATUS: Record<string, WorkStatusValue> = {
  "w-road-rajauli": "in_progress",
  "w-water-meskaur": "sanctioned",
  "w-school-w7": "acknowledged",
  "w-health-kauakol": "acknowledged",
  "w-anganwadi-hisua": "completed",
};

export async function GET() {
  const db = getDb();

  if (!db) {
    const items: StatusItem[] = WORKS.map((w) => ({
      id: w.id,
      title: w.title,
      category: w.category,
      area: w.area,
      demand: w.demand,
      source: w.source,
      status: DEMO_STATUS[w.id] ?? "new",
    }));
    return NextResponse.json({ source: "sample", items });
  }

  try {
    const [rankSnap, statusSnap] = await Promise.all([
      db.collection("rankings").doc("latest").get(),
      db.collection("workStatus").get(),
    ]);

    const statusMap = new Map<string, { status: WorkStatusValue; note?: string; updatedAt?: string }>();
    statusSnap.forEach((d) => {
      const x = d.data();
      if (WORK_STATUSES.includes(x.status)) statusMap.set(d.id, { status: x.status, note: x.note, updatedAt: x.updatedAt });
    });

    const works = (rankSnap.exists && Array.isArray(rankSnap.data()?.works) ? rankSnap.data()!.works : []) as {
      id: string; title: string; category: string; area: string; demand: number; source: string;
    }[];

    // Fall back to the sample works if no live ranking has been computed yet,
    // so the accountability board is never empty.
    const base = works.length ? works : WORKS;
    const items: StatusItem[] = base.map((w) => {
      const s = statusMap.get(w.id);
      return {
        id: w.id, title: w.title, category: w.category, area: w.area, demand: w.demand, source: w.source,
        status: s?.status ?? "new", note: s?.note, updatedAt: s?.updatedAt,
      };
    });
    return NextResponse.json({ source: works.length ? "live" : "sample", items });
  } catch (err) {
    console.warn("[status] read failed:", (err as Error).message);
    return NextResponse.json({ source: "sample", items: [] });
  }
}

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, reason: "no-db", note: "Status tracking needs the live database." }, { status: 200 });

  try {
    const body = await req.json();
    const workId = String(body.workId ?? "").trim();
    const status = String(body.status ?? "").trim() as WorkStatusValue;
    if (!workId || !WORK_STATUSES.includes(status)) {
      return NextResponse.json({ ok: false, error: "workId and a valid status are required." }, { status: 400 });
    }
    await db.collection("workStatus").doc(workId).set(
      {
        status,
        note: body.note ? String(body.note).slice(0, 500) : null,
        workTitle: body.workTitle ? String(body.workTitle).slice(0, 200) : null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true, workId, status });
  } catch (err) {
    console.error("status write error", err);
    return NextResponse.json({ ok: false, error: "Could not update status." }, { status: 400 });
  }
}
