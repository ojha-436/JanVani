"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import {
  CONSTITUENCY,
  DEFAULT_WEIGHTS,
  FACTOR_COLORS,
  FACTOR_ORDER,
  HOTSPOTS,
  THEMES,
  WORKS,
  confidence,
  scoreWork,
  type FactorKey,
  type Weights,
  type Work,
} from "@/lib/dashboardData";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function DashboardPage() {
  const { t } = useI18n();
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);

  const ranked = useMemo(
    () =>
      [...WORKS]
        .map((w) => ({ w, s: scoreWork(w.factors, weights) }))
        .sort((a, b) => b.s - a.s),
    [weights]
  );

  const wsum = FACTOR_ORDER.reduce((a, k) => a + weights[k], 0) || 1;

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  }

  const compareWorks = compare
    .map((id) => WORKS.find((w) => w.id === id))
    .filter((w): w is Work => Boolean(w));

  const kpis = [
    { v: fmt(CONSTITUENCY.voices), l: t.dash.kpiVoices },
    { v: fmt(CONSTITUENCY.themes), l: t.dash.kpiThemes },
    { v: fmt(CONSTITUENCY.areas), l: t.dash.kpiAreas },
    { v: `${CONSTITUENCY.verifiedPct}%`, l: t.dash.kpiVerified },
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
                {CONSTITUENCY.name}, {CONSTITUENCY.state}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <span className="hidden rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm font-semibold sm:inline-block">
              {t.dash.office}
            </span>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-5 py-8">
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

        {/* ---- hotspots + themes ---- */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>
              {t.dash.hotspotsTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{t.dash.hotspotsSub}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {HOTSPOTS.map((a) => (
                <div
                  key={a.name}
                  className="rounded-xl border border-[var(--color-line)] p-3"
                  style={{ backgroundColor: `color-mix(in srgb, var(--color-marigold) ${Math.round(a.demand * 78)}%, #fffdf8)` }}
                >
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">{a.top}</div>
                  <div className="mt-1 font-display text-lg" style={{ fontWeight: 560 }}>
                    {Math.round(a.demand * 100)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
              <span>low</span>
              <span className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, #fffdf8, var(--color-marigold))" }} />
              <span>high demand</span>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>
              {t.dash.themesTitle}
            </h2>
            <div className="mt-5 space-y-3.5">
              {THEMES.map((th) => {
                const max = THEMES[0].count;
                return (
                  <div key={th.category}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{th.category}</span>
                      <span className="tabular-nums text-[var(--color-ink-soft)]">{fmt(th.count)}</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--color-paper-deep)]">
                      <div className="h-full rounded-full" style={{ width: `${(th.count / max) * 100}%`, backgroundColor: th.tone }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
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
}: {
  work: Work;
  score: number;
  rank: number;
  weights: Weights;
  open: boolean;
  onToggle: () => void;
  inCompare: boolean;
  onCompare: () => void;
}) {
  const { t } = useI18n();
  const wsum = FACTOR_ORDER.reduce((a, k) => a + weights[k], 0) || 1;
  const conf = confidence(work.factors);
  const confColor = conf === "high" ? "var(--color-sage)" : conf === "medium" ? "var(--color-marigold-deep)" : "var(--color-terracotta)";

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
