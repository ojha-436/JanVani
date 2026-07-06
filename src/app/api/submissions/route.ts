import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getBucket, getDb, isAdminAvailable } from "@/lib/firebaseAdmin";
import { describePhoto, extractNeed, geocodeToArea, transcribeAudio } from "@/lib/ai";
import { areaCentroid } from "@/lib/publicData";
import { sampleSubmissions, type PublicSubmission } from "@/lib/sampleData";

/* ------------------------------------------------------------------
   POST /api/submissions

   The full ingestion pipeline (ARCHITECTURE.md §5), running per request:
     1. Read multipart form (text + optional voice + optional photo + meta)
     2. Upload voice/photo to Cloud Storage (private bucket)
     3. Transcribe voice → text (Speech-to-Text, Chirp)
     4. Describe photo (Gemini multimodal)
     5. Extract a structured, English-normalised "need" (Gemini, forced JSON)
     6. Geocode the stated area → constituency area
     7. Write a normalised `fact_submission` row to Firestore

   Every Google Cloud step is guarded: with no GOOGLE_CLOUD_PROJECT the
   route still accepts the submission and (if Firestore is reachable)
   stores the citizen's own words — so the UI works in demo mode too.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SALT = process.env.SUBMISSION_SALT || "janvaani-dev-salt";

/** Stable, non-reversible citizen key for dedup / anti-spam (no raw PII). */
function citizenKey(identity: string | null): string {
  if (!identity) return `anon-${randomUUID()}`;
  return "c_" + createHash("sha256").update(SALT + identity).digest("hex").slice(0, 24);
}

async function toBuffer(file: unknown): Promise<Buffer> {
  if (!(file instanceof File)) return Buffer.alloc(0);
  return Buffer.from(await file.arrayBuffer());
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const text = String(form.get("text") ?? "").trim();
    const locale = String(form.get("locale") ?? "en");
    const categoryHint = String(form.get("category") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();
    const coords = form.get("coords") ? safeParse(String(form.get("coords"))) : null;
    const anonymous = form.get("anonymous") !== "false"; // default anonymous
    const verifiedName = String(form.get("verifiedName") ?? "").trim();
    const aadhaarLast4 = String(form.get("aadhaarLast4") ?? "").trim();

    const id = `sub_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    // ---- media → buffers ----
    const audioBuf = await toBuffer(form.get("audio"));
    const photoBuf = await toBuffer(form.get("photo"));
    const photoMime = form.get("photo") instanceof File ? (form.get("photo") as File).type || "image/jpeg" : "image/jpeg";

    // ---- 1. upload media (non-fatal) ----
    const media: { audio?: string; photo?: string } = {};
    const bucket = getBucket();
    if (bucket) {
      await Promise.all([
        audioBuf.length ? saveMedia(bucket, `submissions/${id}/voice.webm`, audioBuf, "audio/webm").then((p) => (media.audio = p)) : null,
        photoBuf.length ? saveMedia(bucket, `submissions/${id}/photo`, photoBuf, photoMime).then((p) => (media.photo = p)) : null,
      ]);
    }

    // ---- 2–4. transcribe + describe + extract (parallel where possible) ----
    const [transcript, photoDescription] = await Promise.all([
      audioBuf.length ? transcribeAudio(audioBuf, locale) : Promise.resolve(""),
      photoBuf.length ? describePhoto(photoBuf, photoMime) : Promise.resolve(""),
    ]);

    const primaryText = text || transcript;
    const extraction = await extractNeed({ text: primaryText, locale, photoDescription, categoryHint });

    // ---- 5. geocode → area ----
    const area = extraction.areaHint || geocodeToArea(location, coords);

    // ---- 6. build the normalised fact row ----
    const identity = anonymous ? null : `${verifiedName}|${aadhaarLast4}`.trim().replace(/^\|+|\|+$/g, "") || null;
    const row = {
      id,
      createdAt: new Date().toISOString(),
      citizenKey: citizenKey(identity),
      channel: "web",
      locale,
      category: extraction.category,
      subcategory: extraction.subcategory,
      need_en: extraction.need_en,
      urgency: extraction.urgency,
      entities: extraction.entities,
      area,
      rawTextPresent: Boolean(text),
      hasAudio: audioBuf.length > 0,
      hasPhoto: photoBuf.length > 0,
      transcript: transcript || null,
      photoDescription: photoDescription || null,
      coords: coords ?? null,
      location: location || null,
      anonymous,
      verifiedName: anonymous ? null : verifiedName || null,
      media,
    };

    // ---- 7. persist to Firestore (non-fatal in demo mode) ----
    let stored = false;
    const db = getDb();
    if (db) {
      try {
        await db.collection("submissions").doc(id).set(row);
        stored = true;
      } catch (e) {
        console.warn("[submissions] Firestore write failed:", (e as Error).message);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        id,
        stored,
        mode: isAdminAvailable() ? "live" : "demo",
        category: extraction.category,
        need_en: extraction.need_en,
        area: area || null,
        transcript: transcript || null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("submission error", err);
    return NextResponse.json({ ok: false, error: "Invalid submission" }, { status: 400 });
  }
}

/* ------------------------------------------------------------------
   GET /api/submissions — dashboard-facing list (map + drill-down).

   Live: latest submissions from Firestore, mapped to the safe
   PublicSubmission shape (anonymity respected, no PII beyond a verified
   name). Demo: a deterministic realistic sample so the map and
   recurring-needs drill-down are fully interactive without a database.
   ------------------------------------------------------------------ */
export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ source: "sample", submissions: sampleSubmissions() });
  }
  try {
    const snap = await db.collection("submissions").orderBy("createdAt", "desc").limit(500).get();
    if (snap.empty) return NextResponse.json({ source: "sample", submissions: sampleSubmissions() });

    const submissions: PublicSubmission[] = snap.docs.map((d) => {
      const x = d.data();
      const area = String(x.area ?? "");
      const anonymous = Boolean(x.anonymous ?? true);
      const coords =
        x.coords && typeof x.coords.lat === "number" && typeof x.coords.lng === "number"
          ? { lat: x.coords.lat, lng: x.coords.lng }
          : jitterCoords(area, d.id);
      return {
        id: d.id,
        category: String(x.category ?? "Other"),
        area,
        need_en: String(x.need_en ?? ""),
        coords,
        createdAt: String(x.createdAt ?? new Date().toISOString()),
        anonymous,
        verified: !anonymous && Boolean(x.verifiedName),
        submitter: anonymous ? "Anonymous citizen" : String(x.verifiedName || "Verified citizen"),
        locale: String(x.locale ?? "en"),
        urgency: typeof x.urgency === "number" ? x.urgency : 0.6,
        hasPhoto: Boolean(x.hasPhoto),
        hasAudio: Boolean(x.hasAudio),
        location: String(x.location ?? area),
      };
    });
    return NextResponse.json({ source: "live", submissions });
  } catch (err) {
    console.warn("[submissions] list failed, using sample:", (err as Error).message);
    return NextResponse.json({ source: "sample", submissions: sampleSubmissions() });
  }
}

/** Stable pseudo-coords around an area centroid for records lacking GPS. */
function jitterCoords(area: string, id: string): { lat: number; lng: number } {
  const c = areaCentroid(area);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const dx = ((h % 1000) / 1000 - 0.5) * 0.045;
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.05;
  return { lat: c.lat + dx, lng: c.lng + dy };
}

function safeParse(s: string): { lat: number; lng: number } | null {
  try {
    const v = JSON.parse(s);
    return typeof v?.lat === "number" && typeof v?.lng === "number" ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}

async function saveMedia(
  bucket: NonNullable<ReturnType<typeof getBucket>>,
  path: string,
  buf: Buffer,
  contentType: string
): Promise<string> {
  await bucket.file(path).save(buf, { contentType, resumable: false, metadata: { cacheControl: "private, max-age=0" } });
  return `gs://${bucket.name}/${path}`;
}
