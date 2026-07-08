import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { askAssistant, type AssistantWork } from "@/lib/ai";
import {
  CONSTITUENCY,
  DEFAULT_WEIGHTS,
  WORKS,
  WORK_STATUSES,
  scoreWork,
  type AssistantResponse,
  type Factors,
  type WorkStatusValue,
} from "@/lib/dashboardData";

/* ------------------------------------------------------------------
   POST /api/assistant  { message, history? }

   The Gemini dashboard assistant. Grounds every answer in the live
   ranked works + momentum + accountability status, and — only when the
   MP clearly asks — proposes a status change the UI asks them to confirm
   before it applies (no silent writes). Falls back to a deterministic
   rule-based responder when Vertex AI is off or errors, so the assistant
   always answers.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RankWork = { id: string; title: string; category: string; area: string; demand: number; factors: Factors; trend?: { direction: string; changePct: number } };

export async function POST(req: Request) {
  let message = "";
  let history: { role: "user" | "assistant"; content: string }[] = [];
  try {
    const body = await req.json();
    message = String(body.message ?? "").slice(0, 800).trim();
    if (Array.isArray(body.history)) {
      history = body.history
        .filter((h: unknown) => h && typeof h === "object")
        .slice(-6)
        .map((h: { role?: string; content?: string }) => ({
          role: h.role === "assistant" ? "assistant" : "user",
          content: String(h.content ?? "").slice(0, 600),
        }));
    }
  } catch {
    /* ignore malformed body */
  }
  if (!message) return NextResponse.json({ reply: "Ask me about demand, momentum, or a work's status." });

  // ---- build grounded context: live ranking + status, else sample ----
  const db = getDb();
  let rankWorks: RankWork[] = WORKS as RankWork[];
  let constituency = { name: CONSTITUENCY.name, state: CONSTITUENCY.state, voices: CONSTITUENCY.voices };
  const statusMap = new Map<string, WorkStatusValue>();

  if (db) {
    try {
      const [rankSnap, statusSnap] = await Promise.all([
        db.collection("rankings").doc("latest").get(),
        db.collection("workStatus").get(),
      ]);
      const data = rankSnap.data();
      if (rankSnap.exists && Array.isArray(data?.works) && data!.works.length) {
        rankWorks = data!.works as RankWork[];
        if (data!.constituency) {
          constituency = {
            name: data!.constituency.name ?? CONSTITUENCY.name,
            state: data!.constituency.state ?? CONSTITUENCY.state,
            voices: data!.constituency.voices ?? CONSTITUENCY.voices,
          };
        }
      }
      statusSnap.forEach((d) => {
        const st = d.data()?.status;
        if (WORK_STATUSES.includes(st)) statusMap.set(d.id, st);
      });
    } catch (e) {
      console.warn("[assistant] context load failed:", (e as Error).message);
    }
  }

  const works: AssistantWork[] = rankWorks.map((w) => ({
    id: w.id,
    title: w.title,
    category: w.category,
    area: w.area,
    demand: w.demand,
    score: scoreWork(w.factors, DEFAULT_WEIGHTS),
    status: statusMap.get(w.id) ?? "new",
    trend: w.trend?.direction,
    changePct: w.trend?.changePct,
  }));

  // ---- Gemini first, deterministic fallback if unavailable ----
  const ai = await askAssistant({ message, works, constituency, history });
  const response: AssistantResponse = ai ?? ruleFallback(message, works);
  return NextResponse.json(response);
}

/* ---------------- deterministic fallback ---------------- */

function ruleFallback(message: string, works: AssistantWork[]): AssistantResponse {
  const m = message.toLowerCase();
  const byScore = [...works].sort((a, b) => b.score - a.score);

  // status-change intent
  const statusWord: Record<string, WorkStatusValue> = {
    complete: "completed",
    completed: "completed",
    done: "completed",
    finished: "completed",
    "in progress": "in_progress",
    progress: "in_progress",
    started: "in_progress",
    sanction: "sanctioned",
    sanctioned: "sanctioned",
    funded: "sanctioned",
    funds: "sanctioned",
    acknowledge: "acknowledged",
    acknowledged: "acknowledged",
  };
  const wantsChange = /\b(mark|set|update|move|change)\b/.test(m);
  if (wantsChange) {
    const status = Object.entries(statusWord).find(([k]) => m.includes(k))?.[1];
    const hit = works.find((w) => m.includes(w.area.toLowerCase())) ?? works.find((w) => m.includes(w.category.toLowerCase().split(" ")[0]));
    if (status && hit) {
      return {
        reply: `Mark "${hit.title}" (${hit.area}) as ${status.replace("_", " ")}? Confirm below to update the dashboard and the public board.`,
        action: { type: "setStatus", workId: hit.id, workTitle: hit.title, status },
      };
    }
  }

  // momentum
  if (/\b(rising|accelerat|momentum|trend|growing|spik)/.test(m)) {
    const rising = works.filter((w) => w.trend === "rising").sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    if (rising.length) {
      const lines = rising.slice(0, 3).map((w) => `${w.title} (${w.area}, +${w.changePct}%)`);
      return { reply: `Rising demand right now: ${lines.join("; ")}. These are accelerating fastest — worth prioritising.` };
    }
    return { reply: "No work is showing a clear rising trend in the last 30 days versus the prior 30." };
  }

  // area-specific
  const area = works.find((w) => m.includes(w.area.toLowerCase()));
  if (area) {
    const inArea = works.filter((w) => w.area === area.area).sort((a, b) => b.score - a.score);
    const lines = inArea.slice(0, 3).map((w) => `${w.title} — score ${w.score}, ${w.demand} citizens, ${w.trend ?? "flat"}${w.trend === "rising" ? ` (+${w.changePct}%)` : ""}`);
    return { reply: `In ${area.area}: ${lines.join("; ")}.` };
  }

  // status summary
  if (/\b(status|progress|acted|done|pending)\b/.test(m)) {
    const acted = works.filter((w) => w.status !== "new");
    return {
      reply: acted.length
        ? `${acted.length} of ${works.length} works have a response status set. Top: ${acted.slice(0, 3).map((w) => `${w.title} — ${w.status.replace("_", " ")}`).join("; ")}.`
        : "No works have a status set yet. Ask me to mark one, e.g. \"mark the Rajauli road in progress\".",
    };
  }

  // default: top priorities
  const top = byScore.slice(0, 3).map((w) => `${w.title} (${w.area}, score ${w.score})`);
  return { reply: `Top priorities by the current weights: ${top.join("; ")}. Ask about momentum ("what's rising?"), an area, or tell me to update a status.` };
}
