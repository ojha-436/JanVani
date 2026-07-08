"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DemandMap } from "@/components/DemandMap";
import { SubmissionDetail } from "@/components/SubmissionDetail";
import { BulkUpload } from "@/components/BulkUpload";
import { TrendBadge } from "@/components/Momentum";
import { AssistantChat } from "@/components/AssistantChat";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/profile";
import { CATEGORY_COLOR, type PublicSubmission } from "@/lib/sampleData";
import {
  CONSTITUENCY,
  DEFAULT_WEIGHTS,
  FACTOR_COLORS,
  FACTOR_ORDER,
  STATUS_META,
  WORK_STATUSES,
  WORKS,
  confidence,
  scoreWork,
  type FactorKey,
  type HotspotArea,
  type Theme,
  type Weights,
  type Work,
  type WorkStatusValue,
} from "@/lib/dashboardData";

/** Live ranking snapshot as returned by GET /api/rankings. */
type LiveData = {
  works: Work[];
  hotspots: HotspotArea[];
  themes: Theme[];
  constituency: typeof CONSTITUENCY;
};

const fmt = (n: number) => n.toLocaleString("en-US");

export default function DashboardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { signOut, session } = useSession();
  const scope = session?.constituency; // MP's allocated constituency, if any
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [live, setLive] = useState<LiveData | null>(null);

  // Individual submissions for the demand map + recurring-needs drill-down.
  const [subs, setSubs] = useState<PublicSubmission[]>([]);
  const [detail, setDetail] = useState<PublicSubmission | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);

  // Accountability status per work id (merged into the ranked list).
  const [statusMap, setStatusMap] = useState<Record<string, WorkStatusValue>>({});

  // Load (and reload, e.g. after a bulk import or status change) the live feeds.
  const refresh = useCallback(() => {
    const subsUrl = scope ? `/api/submissions?constituency=${encodeURIComponent(scope)}` : "/api/submissions";
    fetch(subsUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.submissions)) setSubs(d.submissions);
      })
      .catch(() => {});
    fetch("/api/rankings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.source === "live" && Array.isArray(d.works) && d.works.length) {
          setLive({ works: d.works, hotspots: d.hotspots ?? [], themes: d.themes ?? [], constituency: d.constituency ?? CONSTITUENCY });
        }
      })
      .catch(() => {});
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.items)) {
          const m: Record<string, WorkStatusValue> = {};
          for (const it of d.items) m[it.id] = it.status;
          setStatusMap(m);
        }
      })
      .catch(() => {});
  }, [scope]);

  // Set a work's accountability status (optimistic; persists via /api/status).
  const setWorkStatus = useCallback((workId: string, workTitle: string, status: WorkStatusValue) => {
    setStatusMap((m) => ({ ...m, [workId]: status }));
    fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId, workTitle, status }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Submissions grouped by category, most-recent first (for the drill-down).
  const byCat = useMemo(() => {
    const m = new Map<string, PublicSubmission[]>();
    for (const s of subs) {
      if (!m.has(s.category)) m.set(s.category, []);
      m.get(s.category)!.push(s);
    }
    return m;
  }, [subs]);

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  const works = live?.works ?? WORKS;
  const constituency = live?.constituency ?? CONSTITUENCY;
  const isLive = live !== null;

  // Recurring needs derive from the SAME (constituency-scoped) submissions feed
  // as the drill-down — so a category's count always matches the voices behind
  // it. Previously the count came from the global ranking while the list was
  // scoped, which could show "4" with an empty drill-down.
  const themes = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subs) m.set(s.category, (m.get(s.category) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count, tone: CATEGORY_COLOR[category] ?? "var(--color-marigold)" }));
  }, [subs]);

  // KPIs also reflect the scoped feed, so the headline numbers match the map,
  // the drill-down and the voices this MP can actually see.
  const kpiStats = useMemo(() => {
    const cats = new Set<string>();
    const areas = new Set<string>();
    let verified = 0;
    for (const s of subs) {
      cats.add(s.category);
      if (s.area) areas.add(s.area);
      if (s.verified) verified++;
    }
    return { voices: subs.length, needs: cats.size, areas: areas.size, verifiedPct: subs.length ? Math.round((verified / subs.length) * 100) : 0 };
  }, [subs]);

  const ranked = useMemo(
    () =>
      [...works]
        .map((w) => ({ w, s: scoreWork(w.factors, weights) }))
        .sort((a, b) => b.s - a.s),
    [weights, works]
  );

  const wsum = FACTOR_ORDER.reduce((a, k) => a + weights[k], 0) || 1;

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  }

  const compareWorks = compare
    .map((id) => works.find((w) => w.id === id))
    .filter((w): w is Work => Boolean(w));

  const kpis = [
    { v: fmt(kpiStats.voices), l: t.dash.kpiVoices },
    { v: fmt(kpiStats.needs), l: t.dash.kpiThemes },
    { v: fmt(kpiStats.areas), l: t.dash.kpiAreas },
    { v: `${kpiStats.verifiedPct}%`, l: t.dash.kpiVerified },
  ];

  return (
    <div className="min-h-dvh">
      {/* ---- top bar ---- */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[rgba(246,241,231,0.85)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="JanVaani home">
              <Logo size={30} />
            </Link>
            <span className="hidden h-6 w-px bg-[var(--color-line)] sm:block" />
            <div className="hidden sm:block">
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-[var(--color-terracotta)]">
                {t.dash.badge}
              </p>
              <p className="text-sm font-semibold leading-tight">
                {scope ? scope : `${constituency.name}, ${constituency.state}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex"
              style={{
                backgroundColor: isLive ? "rgba(79,111,96,0.16)" : "rgba(227,154,28,0.16)",
                color: isLive ? "var(--color-sage)" : "var(--color-marigold-deep)",
              }}
              title={isLive ? "Ranked from live citizen submissions" : "Sample snapshot — submit voices and recompute to go live"}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: isLive ? "var(--color-sage)" : "var(--color-marigold-deep)" }} />
              {isLive ? "Live data" : "Sample data"}
            </span>
            <LanguageSwitcher />
            <Link
              href="/status"
              className="hidden rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[var(--color-sage)] hover:text-[var(--color-sage)] sm:inline-block"
              title="Public record of action taken on citizen needs"
            >
              Action taken
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[var(--color-terracotta)] hover:text-[var(--color-terracotta)]"
              aria-label="Sign out"
            >
              <SignOutIcon />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-5 py-8">
        {scope && scope !== CONSTITUENCY.name && (
          <div className="mb-6 rounded-xl border border-[var(--color-marigold)] bg-[rgba(227,154,28,0.1)] px-4 py-3 text-sm">
            Showing <strong>{scope}</strong>&apos;s citizen voices on the map and drill-down. The priority ranking &amp; KPIs below use the
            public-data model currently seeded for <strong>{CONSTITUENCY.name}</strong> — loading {scope}&apos;s datasets is the next step.
          </div>
        )}

        {/* ---- KPI row ---- */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.l} className="card p-5">
              <div className="font-display text-3xl md:text-4xl" style={{ fontWeight: 560 }}>
                {k.v}
              </div>
              <div className="mt-1 text-sm font-medium text-[var(--color-ink-soft)]">{k.l}</div>
            </div>
          ))}
        </div>

        {/* ---- compare panel ---- */}
        {compareWorks.length === 2 && (
          <ComparePanel a={compareWorks[0]} b={compareWorks[1]} weights={weights} onClear={() => setCompare([])} />
        )}

        {/* ---- main grid: ranked list + weights ---- */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h1 className="display-lg">{t.dash.rankedTitle}</h1>
                <p className="mt-1 text-[var(--color-ink-soft)]">{t.dash.rankedSub}</p>
              </div>
            </div>

            {compare.length > 0 && compare.length < 2 && (
              <p className="mb-3 rounded-lg bg-[rgba(227,154,28,0.14)] px-3 py-2 text-sm">{t.dash.compareHint}</p>
            )}

            <ol className="space-y-3">
              {ranked.map(({ w, s }, i) => (
                <WorkCard
                  key={w.id}
                  work={w}
                  score={s}
                  rank={i + 1}
                  weights={weights}
                  open={expanded === w.id}
                  onToggle={() => setExpanded((e) => (e === w.id ? null : w.id))}
                  inCompare={compare.includes(w.id)}
                  onCompare={() => toggleCompare(w.id)}
                  status={statusMap[w.id] ?? w.status ?? "new"}
                  onSetStatus={(st) => setWorkStatus(w.id, w.title, st)}
                />
              ))}
            </ol>
          </section>

          {/* ---- weights ---- */}
          <aside className="lg:col-span-1">
            <div className="card sticky top-20 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>
                  {t.dash.weightsTitle}
                </h2>
                <button className="text-sm font-semibold underline" onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}>
                  {t.dash.reset}
                </button>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{t.dash.weightsSub}</p>
              <div className="mt-5 space-y-4">
                {FACTOR_ORDER.map((k) => (
                  <div key={k}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FACTOR_COLORS[k] }} />
                        {t.dash.factors[k]}
                      </span>
                      <span className="tabular-nums text-[var(--color-ink-soft)]">
                        {Math.round((weights[k] / wsum) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={weights[k]}
                      onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                      className="w-full"
                      style={{ accentColor: FACTOR_COLORS[k] }}
                      aria-label={t.dash.factors[k]}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* ---- demand map ---- */}
        <section className="card mt-8 p-6">
          <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>
            {t.dash.hotspotsTitle}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {t.dash.hotspotsSub} Zoom in to resolve area counts into individual citizen queries; click any point for the full submission.
          </p>
          <div className="mt-4">
            <DemandMap submissions={subs} onSelect={setDetail} />
          </div>
        </section>

        {/* ---- recurring needs (themes) with drill-down ---- */}
        <section className="card mt-6 p-6">
          <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>
            {t.dash.themesTitle}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Click a need to read the citizen voices behind it.</p>
          <div className="mt-5 space-y-2.5">
            {themes.map((th) => {
              const max = themes[0]?.count || 1;
              const list = byCat.get(th.category) ?? [];
              const isOpen = openCat === th.category;
              return (
                <div key={th.category} className="rounded-xl border border-[var(--color-line)]">
                  <button
                    onClick={() => setOpenCat((c) => (c === th.category ? null : th.category))}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-[#fffdf8]"
                      style={{ backgroundColor: CATEGORY_COLOR[th.category] ?? th.tone }}
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold">{th.category}</span>
                        <span className="tabular-nums text-[var(--color-ink-soft)]">{fmt(th.count)}</span>
                      </span>
                      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[var(--color-paper-deep)]">
                        <span className="block h-full rounded-full" style={{ width: `${(th.count / max) * 100}%`, backgroundColor: CATEGORY_COLOR[th.category] ?? th.tone }} />
                      </span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--color-line)] px-3.5 py-3">
                      {list.length === 0 ? (
                        <p className="text-sm text-[var(--color-ink-soft)]">No individual submissions loaded for this need yet.</p>
                      ) : (
                        <>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                            {list.length} citizen {list.length === 1 ? "voice" : "voices"} · click for detail
                          </p>
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {list.slice(0, 12).map((s) => (
                              <li key={s.id}>
                                <button
                                  onClick={() => setDetail(s)}
                                  className="w-full rounded-lg border border-[var(--color-line)] p-2.5 text-left transition-colors hover:border-[var(--color-ink-soft)]"
                                >
                                  <span className="line-clamp-2 text-sm">“{s.need_en}”</span>
                                  <span className="mt-1 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                                    <span className="font-medium">{s.area}</span>
                                    <span>·</span>
                                    <span>{s.verified ? "✓ verified" : "anonymous"}</span>
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                          {list.length > 12 && (
                            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">+ {list.length - 12} more in this need</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- bulk data upload ---- */}
        <BulkUpload onImported={refresh} />
      </main>

      <SubmissionDetail submission={detail} onClose={() => setDetail(null)} />

      {/* ---- Gemini dashboard assistant ---- */}
      <AssistantChat isLive={isLive} onActionApplied={refresh} />
    </div>
  );
}

/* ---------------- Sign-out icon ---------------- */
function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ---------------- Work card ---------------- */
function WorkCard({
  work,
  score,
  rank,
  weights,
  open,
  onToggle,
  inCompare,
  onCompare,
  status,
  onSetStatus,
}: {
  work: Work;
  score: number;
  rank: number;
  weights: Weights;
  open: boolean;
  onToggle: () => void;
  inCompare: boolean;
  onCompare: () => void;
  status: WorkStatusValue;
  onSetStatus: (status: WorkStatusValue) => void;
}) {
  const { t } = useI18n();
  const wsum = FACTOR_ORDER.reduce((a, k) => a + weights[k], 0) || 1;
  const conf = confidence(work.factors);
  const confColor = conf === "high" ? "var(--color-sage)" : conf === "medium" ? "var(--color-marigold-deep)" : "var(--color-terracotta)";
  const statusColor = STATUS_META[status].color;

  return (
    <li className="card overflow-hidden">
      <div className="flex items-stretch">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center bg-[var(--color-ink)] text-[var(--color-paper)]">
          <span className="font-display text-2xl" style={{ fontWeight: 560 }}>
            {rank}
          </span>
        </div>

        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-lg leading-snug" style={{ fontWeight: 560 }}>
                {work.title}
              </h3>
              <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
                {work.category} · {work.area} ·{" "}
                <span className="font-medium">{fmt(work.demand)} {t.dash.citizens}</span>
              </p>
              {work.trend && (
                <div className="mt-2">
                  <TrendBadge trend={work.trend} showSpark />
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-display text-3xl leading-none" style={{ fontWeight: 560 }}>
                {score}
              </div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                {t.dash.score}
              </div>
            </div>
          </div>

          {/* contribution bar */}
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-paper-deep)]" aria-hidden="true">
            {FACTOR_ORDER.map((k) => (
              <div key={k} style={{ width: `${(weights[k] * work.factors[k] / wsum) * 100}%`, backgroundColor: FACTOR_COLORS[k] }} />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: work.source === "citizen" ? "rgba(79,111,96,0.16)" : "rgba(38,58,99,0.14)", color: work.source === "citizen" ? "var(--color-sage)" : "var(--color-indigo)" }}
            >
              {work.source === "citizen" ? t.dash.sourceCitizen : t.dash.sourcePlan}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: confColor }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: confColor }} />
              {t.dash.confidence}: {t.dash[conf]}
            </span>

            <div className="ml-auto flex gap-2">
              <button
                onClick={onCompare}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  inCompare ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line)] hover:border-[var(--color-ink-soft)]"
                }`}
              >
                {t.dash.compare}
              </button>
              <button onClick={onToggle} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold hover:border-[var(--color-ink-soft)]">
                {open ? "▲" : `${t.dash.whyTitle}  ▾`}
              </button>
            </div>
          </div>

          {/* accountability status control */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-paper-deep)] px-2.5 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: statusColor }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
              {STATUS_META[status].label}
            </span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
              Set status
              <select
                value={status}
                onChange={(e) => onSetStatus(e.target.value as WorkStatusValue)}
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 text-xs font-semibold"
                aria-label={`Set status for ${work.title}`}
              >
                {WORK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* drill-down */}
          {open && (
            <div className="mt-4 border-t border-[var(--color-line)] pt-4">
              <p className="eyebrow mb-2 text-[var(--color-terracotta)]">{t.dash.whyTitle}</p>
              <p className="text-[0.95rem] italic leading-relaxed text-[var(--color-ink-soft)]">“{work.rationale}”</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {FACTOR_ORDER.map((k) => (
                  <div key={k}>
                    <div className="flex justify-between text-xs font-medium">
                      <span>{t.dash.factorsShort[k]}</span>
                      <span className="tabular-nums text-[var(--color-ink-soft)]">{Math.round(work.factors[k] * 100)}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-paper-deep)]">
                      <div className="h-full rounded-full" style={{ width: `${work.factors[k] * 100}%`, backgroundColor: FACTOR_COLORS[k] }} />
                    </div>
                  </div>
                ))}
              </div>

              <p className="eyebrow mb-2 mt-5 text-[var(--color-ink-soft)]">{t.dash.evidence}</p>
              <ul className="space-y-1.5">
                {work.evidence.map((e) => (
                  <li key={e} className="flex gap-2 text-sm">
                    <span className="mt-0.5 text-[var(--color-sage)]">✓</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>

              <p className="eyebrow mb-2 mt-5 text-[var(--color-ink-soft)]">{t.dash.quotes}</p>
              <div className="space-y-2">
                {work.quotes.map((q) => (
                  <blockquote key={q} className="border-l-2 border-[var(--color-marigold)] pl-3 text-sm italic text-[var(--color-ink-soft)]">
                    {q}
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------------- Compare panel ---------------- */
function ComparePanel({ a, b, weights, onClear }: { a: Work; b: Work; weights: Weights; onClear: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card mt-6 border-2 border-[var(--color-ink)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>
          {t.dash.comparing}
        </h2>
        <button className="text-sm font-semibold underline" onClick={onClear}>
          {t.dash.clear}
        </button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {[a, b].map((w) => (
          <div key={w.id}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display leading-snug" style={{ fontWeight: 560 }}>
                {w.title}
              </h3>
              <span className="font-display text-2xl" style={{ fontWeight: 560 }}>
                {scoreWork(w.factors, weights)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              {w.category} · {fmt(w.demand)} {t.dash.citizens}
            </p>
            <div className="mt-3 space-y-1.5">
              {FACTOR_ORDER.map((k) => (
                <div key={k}>
                  <div className="flex justify-between text-xs">
                    <span>{t.dash.factorsShort[k]}</span>
                    <span className="tabular-nums text-[var(--color-ink-soft)]">{Math.round(w.factors[k] * 100)}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-paper-deep)]">
                    <div className="h-full rounded-full" style={{ width: `${w.factors[k] * 100}%`, backgroundColor: FACTOR_COLORS[k] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
