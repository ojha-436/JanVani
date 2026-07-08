"use client";

/* ------------------------------------------------------------------
   Public accountability board — "You spoke. We acted."

   The demand side of JanVaani is a listening tool; this page is the
   response side. Anyone (no login) can see how each raised need has
   progressed: Received → Acknowledged → Funds sanctioned → In progress
   → Completed. Closes the loop the brief called for, without needing a
   per-citizen notification channel.
   ------------------------------------------------------------------ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { CATEGORY_COLOR } from "@/lib/sampleData";
import { STATUS_META, WORK_STATUSES, type WorkStatusValue } from "@/lib/dashboardData";

type Item = {
  id: string; title: string; category: string; area: string; demand: number; source: string;
  status: WorkStatusValue; note?: string; updatedAt?: string;
};

const fmt = (n: number) => n.toLocaleString("en-IN");

// Progression order for the funnel (most-advanced first in the "acted" view).
const ACTED: WorkStatusValue[] = ["completed", "in_progress", "sanctioned", "acknowledged"];

export default function StatusPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.items)) {
          setItems(d.items);
          setSource(d.source);
        } else setItems([]);
      })
      .catch(() => setItems([]));
  }, []);

  const counts = useMemo(() => {
    const c: Record<WorkStatusValue, number> = { new: 0, acknowledged: 0, sanctioned: 0, in_progress: 0, completed: 0 };
    (items ?? []).forEach((it) => (c[it.status] = (c[it.status] ?? 0) + 1));
    return c;
  }, [items]);

  const acted = useMemo(
    () =>
      (items ?? [])
        .filter((it) => it.status !== "new")
        .sort((a, b) => ACTED.indexOf(a.status) - ACTED.indexOf(b.status) || b.demand - a.demand),
    [items]
  );
  const received = useMemo(() => (items ?? []).filter((it) => it.status === "new").sort((a, b) => b.demand - a.demand), [items]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-line)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[var(--color-ink)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Dashboard
            </Link>
            <span className="hidden h-6 w-px bg-[var(--color-line)] sm:block" />
            <Link href="/" aria-label="JanVaani home" className="hidden items-center gap-2 sm:flex">
              <Logo size={28} />
              <span className="font-display text-lg" style={{ fontWeight: 560 }}>JanVaani</span>
            </Link>
          </div>
          <Link href="/submit" className="btn btn-primary text-sm">Raise your voice</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="eyebrow text-[var(--color-terracotta)]">Accountability</p>
        <h1 className="display-lg mt-2">You spoke. We acted.</h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--color-ink-soft)]">
          Every need raised by citizens is tracked here — from the moment it&apos;s received to the day it&apos;s done.
          This is the constituency&apos;s public record of response.
        </p>

        {/* progress funnel */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {WORK_STATUSES.map((s) => (
            <div key={s} className="card p-4">
              <div className="font-display text-3xl" style={{ fontWeight: 560, color: STATUS_META[s].color }}>
                {counts[s]}
              </div>
              <div className="mt-0.5 text-sm font-medium text-[var(--color-ink-soft)]">{STATUS_META[s].citizenLabel}</div>
            </div>
          ))}
        </div>

        {items === null ? (
          <p className="mt-10 text-center text-[var(--color-ink-soft)]">Loading the response record…</p>
        ) : (
          <>
            <section className="mt-10">
              <h2 className="font-display text-2xl" style={{ fontWeight: 560 }}>
                In action <span className="text-[var(--color-ink-soft)]">({acted.length})</span>
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Needs the MP&apos;s office has taken up.</p>
              <div className="mt-4 space-y-2.5">
                {acted.length === 0 ? (
                  <p className="text-[var(--color-ink-soft)]">Nothing marked in action yet.</p>
                ) : (
                  acted.map((it) => <Row key={it.id} it={it} />)
                )}
              </div>
            </section>

            {received.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl" style={{ fontWeight: 560 }}>
                  Received <span className="text-[var(--color-ink-soft)]">({received.length})</span>
                </h2>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Heard and counted — awaiting a response decision.</p>
                <div className="mt-4 space-y-2.5">
                  {received.map((it) => <Row key={it.id} it={it} />)}
                </div>
              </section>
            )}
          </>
        )}

        {source === "sample" && (
          <p className="mt-10 rounded-xl bg-[rgba(227,154,28,0.12)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            Showing a sample record. Live status appears here once the MP&apos;s office updates works on the dashboard.
          </p>
        )}
      </main>
    </div>
  );
}

function Row({ it }: { it: Item }) {
  const meta = STATUS_META[it.status];
  const catColor = CATEGORY_COLOR[it.category] ?? "var(--color-marigold)";
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: catColor }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{it.title}</p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {it.category} · {it.area} · {fmt(it.demand)} citizen{it.demand === 1 ? "" : "s"}
        </p>
        {it.note && <p className="mt-1 text-sm italic text-[var(--color-ink-soft)]">“{it.note}”</p>}
      </div>
      <span
        className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
        style={{ color: meta.color, backgroundColor: `color-mix(in srgb, ${meta.color} 15%, transparent)` }}
      >
        {meta.citizenLabel}
      </span>
    </div>
  );
}
