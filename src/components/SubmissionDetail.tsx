"use client";

/* ------------------------------------------------------------------
   Submission detail — the full record a citizen filled, shown when the
   MP clicks a map point or a query in the recurring-needs drill-down.
   Anonymity is respected: anonymous submissions show no identity.
   ------------------------------------------------------------------ */

import { useEffect } from "react";
import { CATEGORY_COLOR, localeLabel, type PublicSubmission } from "@/lib/sampleData";

export function SubmissionDetail({ submission, onClose }: { submission: PublicSubmission | null; onClose: () => void }) {
  useEffect(() => {
    if (!submission) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submission, onClose]);

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

        <div className="mt-5 flex flex-wrap gap-2">
          <Attachment on={s.hasAudio} label="Voice note" icon="🎙️" />
          <Attachment on={s.hasPhoto} label="Photo" icon="📷" />
          {!s.hasAudio && !s.hasPhoto && <span className="text-xs text-[var(--color-ink-soft)]">Text submission</span>}
        </div>
      </div>
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
