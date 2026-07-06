/* ------------------------------------------------------------------
   AI + geo helpers for the ingestion pipeline. All Google Cloud calls
   are guarded: if GOOGLE_CLOUD_PROJECT is unset (local/demo), each
   function falls back to a safe no-op so submissions still store.

   Stack (locked to the organiser's recommended GCP tools):
   - Voice → text:  Cloud Speech-to-Text (Chirp)
   - Photo + text reasoning:  Gemini on Vertex AI
   ------------------------------------------------------------------ */

import { AREA_NAMES, CONSTITUENCY_META } from "./publicData";

// Same single switch as firebaseAdmin: AI calls only fire when
// GOOGLE_CLOUD_PROJECT is set, so demo/local runs make no (paid) Vertex calls.
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const GEMINI_MODEL = process.env.VERTEX_GEMINI_MODEL || "gemini-2.0-flash-001";
const STT_LANG_FALLBACK = "en-IN";

/** Is the AI/analysis stack wired (i.e. do we have a GCP project)? */
export function aiEnabled(): boolean {
  return Boolean(PROJECT);
}

export type Extraction = {
  category: string;
  subcategory: string;
  need_en: string; // normalised English statement of the need
  urgency: number; // 0..1
  entities: string[];
  areaHint: string; // best guess at ward/village/area
};

const CATEGORIES = [
  "Roads & transport",
  "Water & sanitation",
  "Education",
  "Health",
  "Electricity",
  "Livelihood",
  "Other",
];

// BCP-47 codes for Speech-to-Text, keyed by our app locales.
const STT_LANG: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  ta: "ta-IN",
  mr: "mr-IN",
  bn: "bn-IN",
};

/* ---------------- Speech-to-Text (Chirp) ---------------- */

/** Transcribe a short voice note. Returns "" if AI is disabled or it fails. */
export async function transcribeAudio(audio: Buffer, locale: string): Promise<string> {
  if (!aiEnabled() || audio.length === 0) return "";
  try {
    const { SpeechClient } = await import("@google-cloud/speech");
    const client = new SpeechClient();
    const primary = STT_LANG[locale] || STT_LANG_FALLBACK;
    const alternates = Object.values(STT_LANG).filter((l) => l !== primary).slice(0, 3);

    const [res] = await client.recognize({
      audio: { content: audio.toString("base64") },
      config: {
        encoding: "WEBM_OPUS",
        languageCode: primary,
        alternativeLanguageCodes: alternates,
        enableAutomaticPunctuation: true,
        model: "latest_long",
      },
    });
    return (res.results ?? [])
      .map((r) => r.alternatives?.[0]?.transcript ?? "")
      .join(" ")
      .trim();
  } catch (err) {
    console.warn("[ai] transcribeAudio failed:", (err as Error).message);
    return "";
  }
}

/* ---------------- Gemini (Vertex AI) ---------------- */

async function geminiModel() {
  const { VertexAI } = await import("@google-cloud/vertexai");
  const vertex = new VertexAI({ project: PROJECT!, location: LOCATION });
  return vertex.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });
}

function firstJson<T>(raw: string, fallback: T): T {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}

/** Describe an issue photo (labels + one-line description). "" on failure. */
export async function describePhoto(image: Buffer, mimeType: string): Promise<string> {
  if (!aiEnabled() || image.length === 0) return "";
  try {
    const model = await geminiModel();
    const r = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are helping a civic platform. Look at this photo of a local public-infrastructure issue in rural/small-town India. " +
                'Respond as JSON: {"description": string (one factual sentence, English), "labels": string[] (up to 5)}.',
            },
            { inlineData: { mimeType, data: image.toString("base64") } },
          ],
        },
      ],
    });
    const text = r.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = firstJson<{ description?: string; labels?: string[] }>(text, {});
    const labels = (parsed.labels ?? []).join(", ");
    return [parsed.description, labels && `(${labels})`].filter(Boolean).join(" ").trim();
  } catch (err) {
    console.warn("[ai] describePhoto failed:", (err as Error).message);
    return "";
  }
}

/** Extract a structured "need" from raw citizen input (forced JSON). */
export async function extractNeed(input: {
  text: string;
  locale: string;
  photoDescription?: string;
  categoryHint?: string;
}): Promise<Extraction> {
  const combined = [input.text, input.photoDescription].filter(Boolean).join(". ").trim();

  // Fallback used both in demo mode and if Gemini fails: keep the citizen's
  // own words as the canonical need and honour any category they picked.
  const fallback: Extraction = {
    category: input.categoryHint && CATEGORIES.includes(input.categoryHint) ? input.categoryHint : "Other",
    subcategory: "",
    need_en: combined || input.categoryHint || "Unspecified local need",
    urgency: 0.6,
    entities: [],
    areaHint: "",
  };
  if (!aiEnabled() || !combined) return fallback;

  try {
    const model = await geminiModel();
    const prompt = [
      "You normalise raw citizen development requests for an Indian MP's constituency dashboard.",
      `Constituency: ${CONSTITUENCY_META.name}, ${CONSTITUENCY_META.state}. Known areas: ${AREA_NAMES.join(", ")}.`,
      `Categories (pick exactly one): ${CATEGORIES.join(" | ")}.`,
      `Source language locale: ${input.locale}.`,
      input.categoryHint ? `Citizen-selected category hint: ${input.categoryHint}.` : "",
      "",
      "Citizen input (may be a transcript or photo description, in any language):",
      `"""${combined}"""`,
      "",
      "Return ONLY JSON:",
      '{"category": string, "subcategory": string, "need_en": string (clear English, <= 25 words),',
      ' "urgency": number (0..1), "entities": string[], "areaHint": string (one of the known areas, or "")}',
    ].join("\n");

    const r = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = r.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const p = firstJson<Partial<Extraction>>(text, {});

    return {
      category: p.category && CATEGORIES.includes(p.category) ? p.category : fallback.category,
      subcategory: p.subcategory ?? "",
      need_en: (p.need_en ?? "").trim() || fallback.need_en,
      urgency: typeof p.urgency === "number" ? Math.min(1, Math.max(0, p.urgency)) : 0.6,
      entities: Array.isArray(p.entities) ? p.entities.slice(0, 8).map(String) : [],
      areaHint: AREA_NAMES.includes(p.areaHint ?? "") ? (p.areaHint as string) : "",
    };
  } catch (err) {
    console.warn("[ai] extractNeed failed:", (err as Error).message);
    return fallback;
  }
}

/** One-paragraph, grounded "why this rank" rationale. Falls back to a
 *  deterministic template so the dashboard always has a rationale. */
export async function rationaleFor(input: {
  title: string;
  score: number;
  demand: number;
  evidence: string[];
  confidence: string;
}): Promise<string> {
  const template =
    `${input.demand} unique citizens back "${input.title}". ` +
    `${input.evidence.slice(0, 3).join("; ")}. Confidence: ${input.confidence}.`;
  if (!aiEnabled()) return template;
  try {
    const { VertexAI } = await import("@google-cloud/vertexai");
    const vertex = new VertexAI({ project: PROJECT!, location: LOCATION });
    const model = vertex.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { temperature: 0.3 } });
    const prompt =
      "Write ONE plain-language paragraph (<=70 words) explaining why this development work ranks where it does. " +
      "Only use the numbers given; never invent data. Neutral, factual tone.\n" +
      `Work: ${input.title} (score ${input.score}, ${input.demand} unique citizens, confidence ${input.confidence}).\n` +
      `Evidence: ${input.evidence.join("; ")}.`;
    const r = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    return (r.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() || template;
  } catch {
    return template;
  }
}

/* ---------------- Geocoding (area assignment) ---------------- */

/** Map a free-text location / GPS to one of the constituency's areas.
 *  For the hackathon this is a name-match against known areas (no paid
 *  Maps call); coords fall back to the busiest area if no name matches. */
export function geocodeToArea(location: string, _coords?: { lat: number; lng: number } | null): string {
  const loc = (location || "").toLowerCase();
  const hit = AREA_NAMES.find((a) => loc.includes(a.toLowerCase()));
  return hit || "";
}
