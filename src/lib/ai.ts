/* ------------------------------------------------------------------
   AI + geo helpers for the ingestion pipeline. All Google Cloud calls
   are guarded: if GOOGLE_CLOUD_PROJECT is unset (local/demo), each
   function falls back to a safe no-op so submissions still store.

   Stack (locked to the organiser's recommended GCP tools):
   - Voice → text:  Cloud Speech-to-Text (Chirp)
   - Photo + text reasoning:  Gemini on Vertex AI
   ------------------------------------------------------------------ */

import { AREA_NAMES, CONSTITUENCY_META, nearestArea } from "./publicData";
import { WORK_STATUSES, type AssistantResponse, type WorkStatusValue } from "./dashboardData";
import { categoryBand, type CostEstimate } from "./estimate";

// Same single switch as firebaseAdmin: AI calls only fire when
// GOOGLE_CLOUD_PROJECT is set, so demo/local runs make no (paid) Vertex calls.
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const GEMINI_MODEL = process.env.VERTEX_GEMINI_MODEL || "gemini-2.5-flash";
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

/* ---------------- Dashboard assistant (Gemini, grounded) ---------------- */

/** Compact per-work context handed to the assistant. */
export type AssistantWork = {
  id: string;
  title: string;
  category: string;
  area: string;
  demand: number;
  score: number; // 0..100 at default weights
  status: WorkStatusValue;
  trend?: string; // "rising" | "falling" | "flat"
  changePct?: number;
};

/** Answer an MP's question grounded in the live ranked works + momentum +
 *  status, and — only when they clearly ask — propose a status change the MP
 *  confirms before it applies. Returns null when AI is off or the call fails
 *  (the route then uses a deterministic rule-based fallback). */
export async function askAssistant(input: {
  message: string;
  works: AssistantWork[];
  constituency: { name: string; state: string; voices: number };
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<AssistantResponse | null> {
  if (!aiEnabled()) return null;
  try {
    const model = await geminiModel();
    const hist = (input.history ?? [])
      .slice(-6)
      .map((h) => `${h.role === "assistant" ? "Assistant" : "MP"}: ${h.content}`)
      .join("\n");
    const prompt = [
      "You are the assistant embedded in an Indian MP's JanVaani constituency dashboard.",
      `Constituency: ${input.constituency.name}, ${input.constituency.state} — ${input.constituency.voices} citizen voices.`,
      "You help the MP understand citizen demand, its momentum (rising/falling/flat), and act on it.",
      "You are given the current ranked works as JSON. Fields: id, title, category, area, demand (unique citizens),",
      "score (0-100 priority), status, trend, changePct (recent 30d vs prior 30d).",
      "Answer concisely and specifically, citing the real numbers from the data. NEVER invent data or works.",
      `Valid statuses: ${WORK_STATUSES.join(", ")}.`,
      "Only if the MP clearly asks to change/mark/update a work's status, include an action for the matching work id.",
      "",
      "WORKS_JSON:",
      JSON.stringify(input.works),
      hist ? "\nRecent conversation:\n" + hist : "",
      "",
      `MP: ${input.message}`,
      "",
      'Return ONLY JSON: {"reply": string (<=90 words, plain text, no markdown),',
      ' "action"?: {"type":"setStatus","workId": string,"workTitle": string,"status": <one valid status>}}',
    ].join("\n");

    const r = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = r.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const p = firstJson<{ reply?: string; action?: { type?: string; workId?: string; status?: string } }>(text, {});
    const reply = (p.reply ?? "").trim();
    if (!reply) return null;

    let action: AssistantResponse["action"];
    const a = p.action;
    if (a && a.type === "setStatus" && a.workId && WORK_STATUSES.includes(a.status as WorkStatusValue)) {
      const w = input.works.find((x) => x.id === a.workId);
      if (w) action = { type: "setStatus", workId: w.id, workTitle: w.title, status: a.status as WorkStatusValue };
    }
    return { reply, action };
  } catch (err) {
    console.warn("[ai] askAssistant failed:", (err as Error).message);
    return null;
  }
}

/* ---------------- Feasibility & cost estimate (Gemini) ---------------- */

/** Draft a structured feasibility + cost estimate for a citizen need. Grounded
 *  in typical Indian govt Schedule-of-Rates ranges; an early-prioritisation aid,
 *  NOT a quotation. Returns null when AI is off or the call fails (the route
 *  then uses the deterministic category-band fallback). */
export async function estimateFeasibility(input: {
  need: string;
  category: string;
  area: string;
  constituency?: string;
}): Promise<CostEstimate | null> {
  if (!aiEnabled() || !input.need.trim()) return null;
  try {
    const model = await geminiModel();
    const band = categoryBand(input.category);
    const prompt = [
      "You are a civil-works estimator for an Indian MP's constituency (rural / small-town, Bihar context).",
      "Given ONE citizen need, produce a rough feasibility + cost estimate for EARLY PRIORITISATION — NOT a tender or quotation.",
      "Use typical Indian government Schedule-of-Rates ranges, in INR. Be realistic and conservative; prefer a range over a point number.",
      `For reference, ${input.category} works in this setting typically fall roughly between ₹${band.low.toLocaleString("en-IN")} and ₹${band.high.toLocaleString("en-IN")}; only depart from this if the need clearly warrants it.`,
      "MPLADS funds DURABLE COMMUNITY ASSETS (roads, buildings, drinking water, etc.); it does NOT fund salaries, recurring costs, or individual benefits — reflect this in eligibility.",
      "",
      `Citizen need: """${input.need}"""`,
      `Category: ${input.category}. Area: ${input.area || "unspecified"}. Constituency: ${input.constituency || CONSTITUENCY_META.name}.`,
      "",
      "Return ONLY JSON:",
      '{"scope": string (<=20 words),',
      ' "eligibility": {"mplads": boolean, "note": string (<=20 words)},',
      ' "boq": [{"item": string, "qty": string, "note"?: string}] (2–5 line items),',
      ' "costLow": number (INR), "costHigh": number (INR),',
      ' "timelineWeeks": {"low": number, "high": number},',
      ' "risks": string[] (2–4), "assumptions": string[] (1–3),',
      ' "confidence": "low" | "medium" | "high"}',
    ].join("\n");

    const r = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = r.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const p = firstJson<Partial<CostEstimate>>(text, {});

    const costLow = Number(p.costLow);
    const costHigh = Number(p.costHigh);
    if (!Number.isFinite(costLow) || !Number.isFinite(costHigh) || costLow <= 0 || costHigh < costLow) return null;

    const conf = p.confidence === "high" || p.confidence === "medium" || p.confidence === "low" ? p.confidence : "medium";
    const arr = (v: unknown, cap: number): string[] => (Array.isArray(v) ? v.slice(0, cap).map(String) : []);

    return {
      scope: (p.scope ?? "").toString().trim() || `${input.category} works in ${input.area || "the area"}`,
      eligibility: {
        mplads: Boolean(p.eligibility?.mplads),
        note: (p.eligibility?.note ?? "").toString().trim() || "Confirm against current MPLADS guidelines.",
      },
      boq: Array.isArray(p.boq)
        ? p.boq.slice(0, 6).map((b) => ({ item: String(b?.item ?? "Item"), qty: String(b?.qty ?? "—"), note: b?.note ? String(b.note) : undefined }))
        : [],
      costLow: Math.round(costLow),
      costHigh: Math.round(costHigh),
      timelineWeeks: {
        low: Math.max(1, Math.round(Number(p.timelineWeeks?.low) || band.weeks[0])),
        high: Math.max(1, Math.round(Number(p.timelineWeeks?.high) || band.weeks[1])),
      },
      risks: arr(p.risks, 4),
      assumptions: arr(p.assumptions, 3),
      confidence: conf,
      source: "ai",
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[ai] estimateFeasibility failed:", (err as Error).message);
    return null;
  }
}

/* ---------------- Geocoding (area assignment) ---------------- */

/** Map a free-text location / GPS to one of the constituency's areas.
 *  For the hackathon this is a name-match against known areas (no paid
 *  Maps call) first; if the text doesn't name a known area but a GPS fix
 *  was captured (e.g. the voice-complaint flow, which never types a
 *  location), fall back to the nearest area centroid so every submission
 *  with coordinates still resolves to a real area instead of "". */
export function geocodeToArea(location: string, coords?: { lat: number; lng: number } | null): string {
  const loc = (location || "").toLowerCase();
  const hit = AREA_NAMES.find((a) => loc.includes(a.toLowerCase()));
  if (hit) return hit;
  if (coords) return nearestArea(coords);
  return "";
}
