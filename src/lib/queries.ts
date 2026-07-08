"use client";

/* ------------------------------------------------------------------
   Local record of the queries this citizen has raised.

   Submissions are anonymous by design (no server-side link from a
   logged-in profile to a submission), so we keep a lightweight
   per-device list in localStorage. It lets "Your queries" show the
   citizen what they raised and — by matching each query to its ranked
   work — the action the MP has taken on it. In production this would be
   a Firestore lookup keyed by the citizen's verified identity.
   ------------------------------------------------------------------ */

export type LocalQuery = {
  id: string; // submission id
  workId: string; // derived theme id, to look up MP status
  category: string;
  area: string;
  need_en: string;
  createdAt: string; // ISO
};

const KEY = "janvaani.queries";
const CAP = 50;

/** Derive the ranked-work id for a (category, area) — mirrors the id
 *  scheme in ranking.ts so a query maps to the work the MP acts on. */
export function deriveWorkId(category: string, area: string): string {
  return "theme-" + `${category}::${area}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

export function getQueries(): LocalQuery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as LocalQuery[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordQuery(q: LocalQuery): void {
  if (typeof window === "undefined") return;
  try {
    const list = getQueries().filter((x) => x.id !== q.id);
    list.unshift(q);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}
