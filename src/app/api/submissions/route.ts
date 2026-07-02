import { NextResponse } from "next/server";

/* ------------------------------------------------------------------
   POST /api/submissions
   Receives a citizen submission (text + optional voice + optional
   photo + metadata) as multipart form data.

   This stub accepts and acknowledges the submission so the UI is fully
   functional in the hackathon demo. The commented steps below are the
   exact production wiring for Google Cloud — drop-in when the
   @google-cloud/* and Vertex AI SDKs are added.
   ------------------------------------------------------------------ */

export const runtime = "nodejs"; // needs Node APIs for streaming uploads

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const submission = {
      text: String(form.get("text") ?? ""),
      locale: String(form.get("locale") ?? "en"),
      category: String(form.get("category") ?? ""),
      location: String(form.get("location") ?? ""),
      coords: form.get("coords") ? JSON.parse(String(form.get("coords"))) : null,
      anonymous: form.get("anonymous") === "true",
      hasAudio: form.get("audio") instanceof File,
      hasPhoto: form.get("photo") instanceof File,
      createdAt: new Date().toISOString(),
    };

    // ---- PRODUCTION PIPELINE (Google Cloud) -------------------------
    // Ingestion stays fast: persist + publish, then process async.
    //
    // 1. Upload binaries to Cloud Storage (signed, private bucket):
    //      const bucket = new Storage().bucket(process.env.UPLOADS_BUCKET!);
    //      const audioFile = form.get("audio") as File | null; ...
    //
    // 2. Publish to Pub/Sub ("raw-submissions") so a Cloud Run Job
    //    processes it in micro-batches (cost control), doing:
    //      - Speech-to-Text (Chirp) for audio → transcript
    //      - Gemini multimodal for the photo → issue labels
    //      - Translation API → English canonical `need_en`
    //      - Gemini (JSON schema) → {category, urgency, entities}
    //      - Vertex AI embeddings → clustering + dedup vector
    //      - Maps Geocoding → ward/village/constituency
    //
    // 3. Write to Firestore (realtime dashboard) and stream the row to
    //    BigQuery `fact_submission` for the ranking engine.
    //    See docs/ARCHITECTURE.md for the analysis + ranking design.
    // -----------------------------------------------------------------

    const id = `sub_${Math.random().toString(36).slice(2, 10)}`;

    return NextResponse.json({ ok: true, id, submission }, { status: 201 });
  } catch (err) {
    console.error("submission error", err);
    return NextResponse.json({ ok: false, error: "Invalid submission" }, { status: 400 });
  }
}
