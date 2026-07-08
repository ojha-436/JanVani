import { NextResponse } from "next/server";
import { getBucket, getDb } from "@/lib/firebaseAdmin";

/* ------------------------------------------------------------------
   GET /api/media/[id]?kind=audio|photo

   Streams a submission's stored voice note or reference photo from the
   private uploads bucket, so the MP dashboard can play/show evidence.
   Client Storage rules are deny-all by design — all media access is
   server-mediated through this route (same posture as the rest of the
   API). Returns 404 when the submission or that media kind is absent.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind") === "photo" ? "photo" : "audio";

  const db = getDb();
  const bucket = getBucket();
  if (!db || !bucket) return NextResponse.json({ error: "media unavailable in demo mode" }, { status: 404 });

  try {
    const doc = await db.collection("submissions").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "not found" }, { status: 404 });

    const gsUri: string | undefined = doc.data()?.media?.[kind];
    if (!gsUri) return NextResponse.json({ error: `no ${kind}` }, { status: 404 });

    // media paths are stored as gs://<bucket>/<path>
    const path = gsUri.replace(/^gs:\/\/[^/]+\//, "");
    const file = bucket.file(path);
    const [meta] = await file.getMetadata();
    const [buf] = await file.download();

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": String(meta.contentType || (kind === "photo" ? "image/jpeg" : "audio/webm")),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.warn("[media] fetch failed:", (err as Error).message);
    return NextResponse.json({ error: "fetch failed" }, { status: 404 });
  }
}
