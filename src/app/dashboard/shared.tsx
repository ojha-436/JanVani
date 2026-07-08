"use client";

/* Pieces shared by the dashboard's sub-pages (overview / complaints /
   map / progress). Extracted verbatim from the original single-page
   dashboard when it was split into routes — see layout.tsx for the
   shell (auth gating, header, tab nav). */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  COMPLAINT_STATUSES,
  DEPARTMENTS,
  type CompareOut,
  type ComplaintStatus,
  type Department,
  type ProgressOut,
  type RecentComplaint,
} from "@/services/api";

export const RECENT_PAGE_SIZE = 20;

export const fmt = (n: number) => n.toLocaleString("en-US");

export const CONSTITUENCY_LABEL = "Your constituency dashboard";

export const LEVEL_COLOR: Record<string, string> = {
  High: "var(--color-terracotta)",
  Medium: "var(--color-marigold)",
  Low: "var(--color-sage)",
};

export const VERIFICATION_COLOR: Record<string, string> = {
  Strong: "var(--color-sage)",
  Moderate: "var(--color-marigold)",
  Weak: "var(--color-ink-soft)",
};

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

export const STATUS_COLOR: Record<string, string> = {
  new: "var(--color-ink-soft)",
  in_progress: "var(--color-marigold)",
  resolved: "var(--color-sage)",
  rejected: "var(--color-terracotta)",
};

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-[rgba(182,74,52,0.12)] px-4 py-3 text-sm text-[var(--color-terracotta)]"
    >
      <span>{message}</span>
      <button
        type="button"
        className="rounded-full border border-[var(--color-terracotta)] px-3 py-1 text-xs font-semibold"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{label}</p>
    </div>
  );
}

export function ComplaintRow({
  complaint: r,
  busy,
  onUpdate,
}: {
  complaint: RecentComplaint;
  busy: boolean;
  onUpdate: (update: { status?: ComplaintStatus; assigned_department?: Department }) => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-soft)]">
        {r.category && (
          <span className="rounded-full bg-[var(--color-line)] px-2.5 py-1 font-semibold">{r.category}</span>
        )}
        {r.location && <span>{r.location}</span>}
        {r.verification_status && (
          <button
            type="button"
            onClick={() => setWhyOpen(true)}
            title="Why this score?"
            className="rounded-full px-2.5 py-1 font-semibold text-white underline-offset-2 hover:underline"
            style={{ background: VERIFICATION_COLOR[r.verification_status] || "var(--color-ink)" }}
          >
            {r.verification_status} evidence · {r.verification_confidence}% ?
          </button>
        )}
        <span className="ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
      </div>

      <Modal open={whyOpen} onClose={() => setWhyOpen(false)} title="Why this score?">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Computed at submission time by fixed rules (verification.py) — the exact points awarded:
        </p>
        {r.verification_reasons && r.verification_reasons.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--color-ink)]">
            {r.verification_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-ink)]">
            No stored breakdown for this complaint (submitted before reason tracking, or not yet scored).
          </p>
        )}
        {r.verification_confidence != null && (
          <p className="mt-4 text-sm font-bold text-[var(--color-ink)]">
            Total: {r.verification_confidence}/100 → {r.verification_status}
          </p>
        )}
      </Modal>

      {r.text && <p className="mt-2 text-[1.05rem]">{r.text}</p>}
      {r.anonymous && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Anonymous</p>}

      {r.audio_url && <audio className="mt-3 h-9 w-full max-w-sm" controls preload="none" src={r.audio_url} />}
      {r.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.photo_url} alt="Complaint photo" className="mt-3 max-h-48 rounded-lg object-cover" />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ background: STATUS_COLOR[r.status ?? "new"] || "var(--color-ink)" }}
        >
          {STATUS_LABEL[r.status ?? "new"] || r.status || "New"}
        </span>
        <select
          className="rounded-lg border border-[var(--color-line)] bg-transparent px-2 py-1 text-xs"
          value={r.status || "new"}
          disabled={busy}
          onChange={(e) => onUpdate({ status: e.target.value as ComplaintStatus })}
          aria-label="Update complaint status"
        >
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-[var(--color-line)] bg-transparent px-2 py-1 text-xs"
          value={r.assigned_department ?? ""}
          disabled={busy}
          onChange={(e) => onUpdate({ assigned_department: e.target.value as Department })}
          aria-label="Assign to department"
        >
          <option value="" disabled>
            Assign department…
          </option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* Period-over-period comparison. Deltas are plain subtractions of the two
   grouped counts the backend returned — nothing is modeled or projected. */
export function CompareSection({ data }: { data: CompareOut }) {
  const { current, previous } = data;
  const fmtRange = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  const prevByCat = new Map(previous.by_category.map((c) => [c.category, c.count]));
  const rows = current.by_category.map((c) => ({
    category: c.category,
    now: c.count,
    before: prevByCat.get(c.category) ?? 0,
  }));
  for (const p of previous.by_category) {
    if (!rows.some((row) => row.category === p.category)) {
      rows.push({ category: p.category, now: 0, before: p.count });
    }
  }
  rows.sort((a, b) => b.now - a.now);

  const delta = (now: number, before: number) => {
    const d = now - before;
    if (d === 0) return <span className="text-[var(--color-ink-soft)]">→ 0</span>;
    return d > 0 ? (
      <span className="font-bold text-[var(--color-terracotta)]">↑ {d}</span>
    ) : (
      <span className="font-bold text-[var(--color-sage)]">↓ {Math.abs(d)}</span>
    );
  };

  return (
    <section className="card mt-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-[var(--color-ink)]">
          {fmtRange(current.from_date)} – {fmtRange(current.to_date)}
          <span className="mx-2 text-[var(--color-ink-soft)]">vs</span>
          {fmtRange(previous.from_date)} – {fmtRange(previous.to_date)}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-2xl font-bold">{current.total}</p>
          <p className="text-xs text-[var(--color-ink-soft)]">complaints · {delta(current.total, previous.total)}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{current.resolved}</p>
          <p className="text-xs text-[var(--color-ink-soft)]">resolved · {delta(current.resolved, previous.resolved)}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{previous.total}</p>
          <p className="text-xs text-[var(--color-ink-soft)]">previous period</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{previous.resolved}</p>
          <p className="text-xs text-[var(--color-ink-soft)]">previous resolved</p>
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-[var(--color-line)] pt-4">
          {rows.slice(0, 6).map((row) => (
            <li key={row.category} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-[var(--color-ink)]">{row.category}</span>
              <span className="text-[var(--color-ink-soft)]">
                {row.before} → {row.now} · {delta(row.now, row.before)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProgressTracker({ progress }: { progress: ProgressOut }) {
  const total = progress.by_status.reduce((s, c) => s + c.count, 0);
  return (
    <section className="mt-10">
      <p className="eyebrow text-[var(--color-ink-soft)]">Progress tracker</p>
      <div className="card mt-4 p-6 sm:p-8">
        {total === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">No complaints to track yet.</p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
              {COMPLAINT_STATUSES.map((s) => {
                const count = progress.by_status.find((c) => c.status === s)?.count ?? 0;
                if (count === 0) return null;
                return (
                  <div
                    key={s}
                    style={{ width: `${(count / total) * 100}%`, background: STATUS_COLOR[s] }}
                    title={`${STATUS_LABEL[s]}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--color-ink-soft)]">
              {COMPLAINT_STATUSES.map((s) => {
                const count = progress.by_status.find((c) => c.status === s)?.count ?? 0;
                return (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                    {STATUS_LABEL[s]}: {fmt(count)}
                  </span>
                );
              })}
            </div>
          </>
        )}

        {progress.by_department.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-[var(--color-line)] pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
              By department
            </p>
            {progress.by_department.map((d) => {
              const deptTotal = d.by_status.reduce((s, c) => s + c.count, 0);
              return (
                <div key={d.department} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 font-medium">{d.department}</span>
                  <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                    {COMPLAINT_STATUSES.map((s) => {
                      const count = d.by_status.find((c) => c.status === s)?.count ?? 0;
                      if (count === 0 || deptTotal === 0) return null;
                      return (
                        <div
                          key={s}
                          style={{ width: `${(count / deptTotal) * 100}%`, background: STATUS_COLOR[s] }}
                          title={`${STATUS_LABEL[s]}: ${count}`}
                        />
                      );
                    })}
                  </div>
                  <span className="w-10 shrink-0 text-right text-[var(--color-ink-soft)]">{deptTotal}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
