"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HotspotMap } from "@/components/HotspotMap";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { auth } from "@/lib/firebase";
import {
  getDashboardSummary,
  getDashboardEvidence,
  getDashboardConsensus,
  type DashboardSummary,
  type EvidenceOut,
  type ConsensusCluster,
} from "@/services/api";

const fmt = (n: number) => n.toLocaleString("en-US");

const LEVEL_COLOR: Record<string, string> = {
  High: "var(--color-terracotta)",
  Medium: "var(--color-marigold)",
  Low: "var(--color-sage)",
};

const VERIFICATION_COLOR: Record<string, string> = {
  Strong: "var(--color-sage)",
  Moderate: "var(--color-marigold)",
  Weak: "var(--color-ink-soft)",
};

export default function DashboardPage() {
  const { t } = useI18n();
  const { ready, firebaseUser, isMp } = useSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceOut | null>(null);
  const [consensus, setConsensus] = useState<ConsensusCluster[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!firebaseUser) {
      window.location.href = "/sign-in?role=mp";
      return;
    }
    if (!isMp) {
      window.location.href = "/";
      return;
    }
    auth!.currentUser!
      .getIdToken()
      .then((idToken) =>
        Promise.all([getDashboardSummary(idToken), getDashboardEvidence(idToken), getDashboardConsensus(idToken)])
      )
      .then(([s, e, c]) => {
        setSummary(s);
        setEvidence(e);
        setConsensus(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, [ready, firebaseUser, isMp]);

  if (!ready || !firebaseUser || !isMp) return null;

  const maxCategoryCount = summary?.by_category.reduce((m, c) => Math.max(m, c.count), 0) || 1;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[rgba(246,241,231,0.82)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" aria-label="JanVaani home">
            <Logo size={30} />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <div className="relative">
              <button
                className="btn btn-ghost !p-2.5 !min-h-0"
                aria-label="Menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              {menuOpen && (
                <ul role="menu" className="card absolute right-0 mt-2 w-56 overflow-hidden p-1.5 z-50 shadow-xl">
                  <li>
                    <Link
                      href="/gov-data"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[var(--color-line)]"
                    >
                      Update gov data
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-4xl px-5 py-12">
        <p className="eyebrow text-[var(--color-terracotta)]">{t.dash.badge}</p>
        <h1 className="display-lg mt-2">{CONSTITUENCY_LABEL}</h1>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-[rgba(182,74,52,0.12)] px-4 py-3 text-sm text-[var(--color-terracotta)]">
            {error}
          </p>
        )}

        {!summary && !error && <p className="mt-8 text-[var(--color-ink-soft)]">Loading…</p>}

        {summary && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Kpi label={t.dash.kpiVoices} value={fmt(summary.total_complaints)} />
              <Kpi label={t.dash.kpiThemes} value={fmt(summary.by_category.length)} />
              <Kpi label={t.dash.kpiAreas} value={fmt(summary.distinct_locations)} />
            </div>

            {evidence && (
              <section className="mt-10">
                <p className="eyebrow text-[var(--color-ink-soft)]">Priority evidence</p>
                <div className="card mt-4 p-6 sm:p-8">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                      style={{ background: LEVEL_COLOR[evidence.level] || "var(--color-ink)" }}
                    >
                      {evidence.score}
                    </div>
                    <div>
                      <p className="text-lg font-bold">{evidence.level} priority</p>
                      <p className="text-sm text-[var(--color-ink-soft)]">Evidence score out of 100</p>
                    </div>
                  </div>

                  {evidence.explanation && (
                    <p className="mt-5 text-[1.05rem] leading-relaxed">{evidence.explanation}</p>
                  )}

                  {evidence.reasons.length > 0 && (
                    <ul className="mt-5 space-y-2 border-t border-[var(--color-line)] pt-5">
                      {evidence.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                          <span className="mt-0.5 text-[var(--color-sage)]">✓</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {consensus.length > 0 && (
              <section className="mt-10">
                <p className="eyebrow text-[var(--color-ink-soft)]">Linked issues</p>
                <div className="mt-4 space-y-4">
                  {consensus.map((c, i) => (
                    <div key={i} className="card p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {c.categories.map((cat) => (
                          <span key={cat} className="rounded-full bg-[var(--color-line)] px-2.5 py-1 font-semibold">
                            {cat}
                          </span>
                        ))}
                        <span className="text-[var(--color-ink-soft)]">{c.location_hint}</span>
                        <span className="ml-auto font-semibold text-[var(--color-terracotta)]">
                          {c.confidence}% confidence
                        </span>
                      </div>
                      <p className="mt-3 text-[1.05rem]">
                        <strong>{c.complaint_count} complaints</strong> may share one root cause: {c.root_cause}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-10">
              <p className="eyebrow text-[var(--color-ink-soft)]">Hotspot map</p>
              <div className="card mt-4 overflow-hidden p-2">
                <HotspotMap points={summary.map_points} />
              </div>
            </section>

            {summary.total_complaints === 0 ? (
              <div className="card mt-10 p-8 text-center text-[var(--color-ink-soft)]">
                No complaints have been submitted yet. Once citizens raise their voice, they&apos;ll show up here —
                grouped by what they&apos;re about.
              </div>
            ) : (
              <>
                <section className="mt-10">
                  <p className="eyebrow text-[var(--color-ink-soft)]">{t.dash.themesTitle}</p>
                  <div className="card mt-4 p-6 sm:p-8">
                    <div className="space-y-4">
                      {summary.by_category.map((c) => (
                        <div key={c.category}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-semibold">{c.category}</span>
                            <span className="text-[var(--color-ink-soft)]">
                              {fmt(c.count)} {t.dash.citizens}
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-marigold)]"
                              style={{ width: `${Math.max(6, (c.count / maxCategoryCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="mt-10">
                  <p className="eyebrow text-[var(--color-ink-soft)]">Recent submissions</p>
                  <div className="card mt-4 divide-y divide-[var(--color-line)] p-0">
                    {summary.recent.map((r) => (
                      <div key={r.id} className="p-5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                          {r.category && (
                            <span className="rounded-full bg-[var(--color-line)] px-2.5 py-1 font-semibold">
                              {r.category}
                            </span>
                          )}
                          {r.location && <span>{r.location}</span>}
                          {r.has_audio && <span>🎙️ voice</span>}
                          {r.has_photo && <span>📷 photo</span>}
                          {r.verification_status && (
                            <span
                              className="rounded-full px-2.5 py-1 font-semibold text-white"
                              style={{ background: VERIFICATION_COLOR[r.verification_status] || "var(--color-ink)" }}
                            >
                              {r.verification_status} evidence · {r.verification_confidence}%
                            </span>
                          )}
                          <span className="ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        {r.text && <p className="mt-2 text-[1.05rem]">{r.text}</p>}
                        {r.anonymous && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Anonymous</p>}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const CONSTITUENCY_LABEL = "Your constituency dashboard";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{label}</p>
    </div>
  );
}
