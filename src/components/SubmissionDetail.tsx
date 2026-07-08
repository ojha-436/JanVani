"use client";

/* ------------------------------------------------------------------
   Submission detail — the full record a citizen filled, shown when the
   MP clicks a map point or a query in the recurring-needs drill-down.
   Anonymity is respected: anonymous submissions show no identity.
   ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { CATEGORY_COLOR, localeLabel, type PublicSubmission } from "@/lib/sampleData";
import { formatINR, type CostEstimate } from "@/lib/estimate";

export function SubmissionDetail({ submission, onClose }: { submission: PublicSubmission | null; onClose: () => void }) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estError, setEstError] = useState<string | null>(null);

  useEffect(() => {
    if (!submission) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submission, onClose]);

  // Reset the estimate when a different voice is opened.
  useEffect(() => {
    setEstimate(null);
    setEstError(null);
    setEstimating(false);
  }, [submission?.id]);

  async function runEstimate() {
    if (!submission) return;
    setEstimating(true);
    setEstError(null);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, need: submission.need_en, category: submission.category, area: submission.area }),
      });
      const data = await res.json();
      if (data.ok && data.estimate) setEstimate(data.estimate);
      else setEstError(data.error || "Could not produce an estimate.");
    } catch {
      setEstError("Estimate request failed — please try again.");
    } finally {
      setEstimating(false);
    }
  }

  if (!submission) return null;
  const s = submission;
  const date = new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const color = CATEGORY_COLOR[s.category] ?? "var(--color-marigold)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(22,34,29,0.55)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Submission detail"
    >
      <div
        className="card max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none rounded-t-2xl p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-[#fffdf8]" style={{ backgroundColor: color }}>
              {s.category}
            </span>
            {s.verified ? (
              <span className="flex items-center gap-1 rounded-full bg-[rgba(79,111,96,0.16)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-sage)]">
                ✓ Aadhaar-verified
              </span>
            ) : (
              <span className="rounded-full bg-[var(--color-paper-deep)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink-soft)]">
                Anonymous
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ×
          </button>
        </div>

        <p className="mt-4 font-display text-xl leading-snug" style={{ fontWeight: 560 }}>
          “{s.need_en}”
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="Submitted by" value={s.submitter} />
          <Field label="Date" value={date} />
          <Field label="Area" value={s.area} />
          <Field label="Location" value={s.location} />
          <Field label="Language" value={localeLabel(s.locale)} />
          <Field label="Urgency" value={`${Math.round(s.urgency * 100)}%`} />
        </dl>

        {/* ---- evidence: reference photo + voice note (live media) ---- */}
        {s.photoUrl && (
          <div className="mt-5">
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
              📷 Reference photo
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.photoUrl}
              alt={`Photo evidence submitted for: ${s.need_en}`}
              className="max-h-72 w-full rounded-xl border border-[var(--color-line)] object-contain"
              style={{ background: "var(--color-paper-deep)" }}
            />
          </div>
        )}
        {s.audioUrl && (
          <div className="mt-5">
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
              🎙️ Citizen's voice note
            </p>
            <audio controls preload="none" src={s.audioUrl} className="w-full" />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Attachment on={s.hasAudio && !s.audioUrl} label="Voice note" icon="🎙️" />
          <Attachment on={s.hasPhoto && !s.photoUrl} label="Photo" icon="📷" />
          {!s.hasAudio && !s.hasPhoto && <span className="text-xs text-[var(--color-ink-soft)]">Text submission</span>}
        </div>

        {/* ---- feasibility & cost estimate (MP-triggered agent) ---- */}
        <div className="mt-6 border-t border-[var(--color-line)] pt-5">
          {!estimate && (
            <button
              onClick={runEstimate}
              disabled={estimating}
              className="btn btn-primary w-full text-sm disabled:opacity-60"
            >
              {estimating ? "Estimating…" : "⚙️ Estimate feasibility & cost"}
            </button>
          )}
          {estError && <p className="mt-2 text-sm text-[var(--color-terracotta)]">{estError}</p>}
          {estimate && <EstimateView est={estimate} onRefresh={runEstimate} refreshing={estimating} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- estimate render ---------------- */
function EstimateView({ est, onRefresh, refreshing }: { est: CostEstimate; onRefresh: () => void; refreshing: boolean }) {
  const confColor = est.confidence === "high" ? "var(--color-sage)" : est.confidence === "medium" ? "var(--color-marigold-deep)" : "var(--color-terracotta)";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-[var(--color-terracotta)]">Feasibility &amp; cost</p>
        <button onClick={onRefresh} disabled={refreshing} className="text-xs font-semibold underline disabled:opacity-50">
          {refreshing ? "…" : "Re-estimate"}
        </button>
      </div>

      <p className="mt-2 font-medium">{est.scope}</p>

      {/* cost band */}
      <div className="mt-3 flex items-end justify-between gap-3 rounded-xl bg-[var(--color-paper-deep)] px-4 py-3">
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Indicative cost</div>
          <div className="font-display text-2xl" style={{ fontWeight: 560 }}>
            {formatINR(est.costLow)} – {formatINR(est.costHigh)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Timeline</div>
          <div className="font-semibold">{est.timelineWeeks.low}–{est.timelineWeeks.high} wks</div>
        </div>
      </div>

      {/* eligibility + confidence */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            color: est.eligibility.mplads ? "var(--color-sage)" : "var(--color-terracotta)",
            backgroundColor: est.eligibility.mplads ? "rgba(79,111,96,0.14)" : "rgba(182,74,52,0.14)",
          }}
        >
          {est.eligibility.mplads ? "✓ Likely MPLADS-eligible" : "⚠ Check MPLADS eligibility"}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: confColor }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: confColor }} />
          {est.confidence} confidence
        </span>
        <span className="text-xs text-[var(--color-ink-soft)]">{est.source === "ai" ? "AI-drafted" : "category estimate"}</span>
      </div>
      {est.eligibility.note && <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">{est.eligibility.note}</p>}

      {/* bill of quantities */}
      {est.boq.length > 0 && (
        <div className="mt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Rough bill of quantities</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {est.boq.map((b, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{b.item}{b.note ? ` — ${b.note}` : ""}</span>
                <span className="shrink-0 text-[var(--color-ink-soft)]">{b.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* risks + assumptions */}
      {est.risks.length > 0 && (
        <div className="mt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Risks</p>
          <ul className="mt-1 list-inside list-disc text-sm text-[var(--color-ink-soft)]">
            {est.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {est.assumptions.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          <span className="font-semibold">Assumptions:</span> {est.assumptions.join("; ")}.
        </p>
      )}

      <p className="mt-4 rounded-lg bg-[rgba(227,154,28,0.12)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
        ⚠️ AI estimate for prioritisation only — not a quotation. Verify with a PWD Schedule-of-Rates estimate before sanctioning.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Attachment({ on, label, icon }: { on: boolean; label: string; icon: string }) {
  if (!on) return null;
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold">
      <span aria-hidden>{icon}</span> {label}
    </span>
  );
}
