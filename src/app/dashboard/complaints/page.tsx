"use client";

/* Dashboard · Complaints — the working list: category/status filters,
   themes breakdown, one-click status + department actions, pagination. */

import { useCallback, useEffect, useState } from "react";
import { SkeletonCard } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";
import { auth } from "@/lib/firebase";
import {
  getDashboardSummary,
  listComplaints,
  updateComplaint,
  COMPLAINT_STATUSES,
  type CategoryCount,
  type ComplaintStatus,
  type Department,
  type RecentComplaint,
} from "@/services/api";
import { ComplaintRow, DashboardError, RECENT_PAGE_SIZE, STATUS_LABEL, fmt } from "../shared";

export default function DashboardComplaintsPage() {
  const { t } = useI18n();
  const [byCategory, setByCategory] = useState<CategoryCount[]>([]);
  const [complaints, setComplaints] = useState<RecentComplaint[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number, cat: string, st: string) => {
      setLoading(true);
      setError(null);
      try {
        const idToken = await auth!.currentUser!.getIdToken();
        const page = await listComplaints(idToken, {
          category: cat || undefined,
          status: st || undefined,
          limit: RECENT_PAGE_SIZE + 1,
          offset,
        });
        setHasMore(page.length > RECENT_PAGE_SIZE);
        const items = page.slice(0, RECENT_PAGE_SIZE);
        setComplaints((prev) => (offset === 0 ? items : [...prev, ...items]));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load complaints");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!auth?.currentUser) return;
    load(0, category, status);
  }, [category, status, load]);

  useEffect(() => {
    if (!auth?.currentUser) return;
    auth.currentUser
      .getIdToken()
      .then((idToken) => getDashboardSummary(idToken, { recentLimit: 1 }))
      .then((s) => setByCategory(s.by_category))
      .catch(() => {});
  }, []);

  async function applyComplaintUpdate(
    complaintId: string,
    update: { status?: ComplaintStatus; assigned_department?: Department }
  ) {
    setStatusUpdating(complaintId);
    setError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      const updated = await updateComplaint(idToken, complaintId, update);
      setComplaints((prev) => prev.map((r) => (r.id === complaintId ? { ...r, ...updated } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update complaint");
    } finally {
      setStatusUpdating(null);
    }
  }

  const maxCategoryCount = byCategory.reduce((m, c) => Math.max(m, c.count), 0) || 1;

  return (
    <>
      {error && <DashboardError message={error} onRetry={() => load(0, category, status)} />}

      {byCategory.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow text-[var(--color-ink-soft)]">{t.dash.themesTitle}</p>
          <div className="card mt-4 p-6 sm:p-8">
            <div className="space-y-4">
              {byCategory.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setCategory(category === c.category ? "" : c.category)}
                  aria-pressed={category === c.category}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={`font-semibold ${category === c.category ? "text-[var(--color-marigold-deep)]" : ""}`}>
                      {c.category}
                    </span>
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
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow text-[var(--color-ink-soft)]">Complaints</p>
          <div className="ml-auto flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-field)] px-2 py-1.5 text-xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {byCategory.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-field)] px-2 py-1.5 text-xs"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {COMPLAINT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && complaints.length === 0 ? (
          <div className="mt-4 space-y-4">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        ) : complaints.length === 0 ? (
          <div className="card mt-4 p-8 text-center text-[var(--color-ink-soft)]">
            No complaints match these filters.
          </div>
        ) : (
          <>
            <div className="card mt-4 divide-y divide-[var(--color-line)] p-0">
              {complaints.map((r) => (
                <ComplaintRow
                  key={r.id}
                  complaint={r}
                  busy={statusUpdating === r.id}
                  onUpdate={(update) => applyComplaintUpdate(r.id, update)}
                />
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                className="btn btn-ghost mt-4 w-full"
                onClick={() => load(complaints.length, category, status)}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
