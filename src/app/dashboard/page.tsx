"use client";

/* Dashboard · Overview — KPIs, compare mode, evidence + ranked issues
   (with per-category complaint drill-down), consensus clusters. The
   shell (auth, header, tabs) lives in layout.tsx. */

import { useEffect, useState } from "react";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";
import { auth } from "@/lib/firebase";
import {
  getDashboardSummary,
  getDashboardEvidence,
  getDashboardConsensus,
  getDashboardCompare,
  getRankedIssues,
  listComplaints,
  updateComplaint,
  type CompareOut,
  type DashboardSummary,
  type EvidenceOut,
  type ConsensusCluster,
  type RankedIssue,
  type RecentComplaint,
  type ComplaintStatus,
  type Department,
} from "@/services/api";
import {
  CompareSection,
  ComplaintRow,
  DashboardError,
  Kpi,
  LEVEL_COLOR,
  fmt,
} from "./shared";

export default function DashboardOverviewPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceOut | null>(null);
  const [consensus, setConsensus] = useState<ConsensusCluster[]>([]);
  const [rankedIssues, setRankedIssues] = useState<RankedIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [exploreCategory, setExploreCategory] = useState<string | null>(null);
  const [exploreComplaints, setExploreComplaints] = useState<RecentComplaint[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [compare, setCompare] = useState<CompareOut | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  async function toggleCompare() {
    const next = !compareOpen;
    setCompareOpen(next);
    if (next && !compare && auth?.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        setCompare(await getDashboardCompare(idToken, 30));
      } catch (e) {
        console.error("Failed to load compare data", e);
      }
    }
  }

  async function loadOverview() {
    setError(null);
    setRetryAction(null);
    setLoading(true);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      // summary is the one call this page can't render without — the rest
      // degrades gracefully against an older deployed backend.
      setSummary(await getDashboardSummary(idToken, { recentLimit: 1 }));
      const [e, c, ranked] = await Promise.allSettled([
        getDashboardEvidence(idToken),
        getDashboardConsensus(idToken),
        getRankedIssues(idToken),
      ]);
      if (e.status === "fulfilled") setEvidence(e.value);
      if (c.status === "fulfilled") setConsensus(c.value);
      if (ranked.status === "fulfilled") setRankedIssues(ranked.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
      setRetryAction(() => loadOverview);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth?.currentUser) loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchExploreComplaints(category: string) {
    setExploreLoading(true);
    setError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      setExploreComplaints(await listComplaints(idToken, { category, limit: 20 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load complaints for this category");
      setRetryAction(() => () => fetchExploreComplaints(category));
    } finally {
      setExploreLoading(false);
    }
  }

  function toggleExplore(category: string) {
    if (exploreCategory === category) {
      setExploreCategory(null);
      setExploreComplaints([]);
      return;
    }
    setExploreCategory(category);
    fetchExploreComplaints(category);
  }

  async function applyComplaintUpdate(
    complaintId: string,
    update: { status?: ComplaintStatus; assigned_department?: Department }
  ) {
    setStatusUpdating(complaintId);
    setError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      const updated = await updateComplaint(idToken, complaintId, update);
      setExploreComplaints((prev) => prev.map((r) => (r.id === complaintId ? { ...r, ...updated } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update complaint");
      setRetryAction(() => () => applyComplaintUpdate(complaintId, update));
    } finally {
      setStatusUpdating(null);
    }
  }

  return (
    <>
      {error && <DashboardError message={error} onRetry={retryAction ?? loadOverview} />}

      {loading && !summary && (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <SkeletonCard lines={3} />
        </div>
      )}

      {summary && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Kpi label={t.dash.kpiVoices} value={fmt(summary.total_complaints)} />
            <Kpi label={t.dash.kpiThemes} value={fmt(summary.by_category.length)} />
            <Kpi label={t.dash.kpiAreas} value={fmt(summary.distinct_locations)} />
          </div>

          <div className="no-print mt-4">
            <button
              type="button"
              onClick={toggleCompare}
              aria-expanded={compareOpen}
              className={`chip text-sm ${compareOpen ? "chip-active" : ""}`}
            >
              {compareOpen ? "Hide comparison" : "Compare: last 30 days vs previous 30"}
            </button>
          </div>
          {compareOpen && compare && <CompareSection data={compare} />}

          {evidence && (
            <section className="mt-10">
              <p className="eyebrow text-[var(--color-ink-soft)]">Ranked issues</p>
              <div className="card mt-4 p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ background: LEVEL_COLOR[evidence.level] || "var(--color-ink)" }}
                  >
                    {evidence.score}
                  </div>
                  <div>
                    <p className="text-lg font-bold">{evidence.level} overall priority</p>
                    <p className="text-sm text-[var(--color-ink-soft)]">Evidence score out of 100</p>
                  </div>
                </div>
                {evidence.explanation && (
                  <p className="mt-5 text-[1.05rem] leading-relaxed">{evidence.explanation}</p>
                )}
              </div>

              {rankedIssues.length > 0 && (
                <div className="mt-4 space-y-3">
                  {rankedIssues.map((issue) => (
                    <div key={issue.category} className="card p-5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-4 text-left"
                        onClick={() => toggleExplore(issue.category)}
                        aria-expanded={exploreCategory === issue.category}
                      >
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: LEVEL_COLOR[issue.level] || "var(--color-ink)" }}
                        >
                          {issue.score}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{issue.category}</p>
                          <p className="text-sm text-[var(--color-ink-soft)]">
                            {fmt(issue.complaint_count)} complaints
                            {issue.population != null && ` · population ${fmt(Math.round(issue.population))}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--color-ink-soft)]">
                          {exploreCategory === issue.category ? "Hide" : "Explore"}
                        </span>
                      </button>

                      {exploreCategory === issue.category && (
                        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
                          {issue.reasons.length > 0 && (
                            <ul className="space-y-1.5">
                              {issue.reasons.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                                  <span className="mt-0.5 text-[var(--color-sage)]">✓</span>
                                  {r}
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                            Underlying complaints
                          </p>
                          {exploreLoading ? (
                            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Loading…</p>
                          ) : (
                            <div className="mt-2 divide-y divide-[var(--color-line)]">
                              {exploreComplaints.map((r) => (
                                <ComplaintRow
                                  key={r.id}
                                  complaint={r}
                                  busy={statusUpdating === r.id}
                                  onUpdate={(update) => applyComplaintUpdate(r.id, update)}
                                />
                              ))}
                              {exploreComplaints.length === 0 && (
                                <p className="py-3 text-sm text-[var(--color-ink-soft)]">No complaints found.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

          {summary.total_complaints === 0 && (
            <div className="card mt-10 p-8 text-center text-[var(--color-ink-soft)]">
              No complaints have been submitted yet. Once citizens raise their voice, they&apos;ll show up here —
              grouped by what they&apos;re about.
            </div>
          )}
        </>
      )}
    </>
  );
}
