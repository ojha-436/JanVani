"use client";

/* Complaint status → colored pill. Colors come from theme tokens so the
   badge reads correctly in both light and dark mode. */

const STATUS_STYLES: Record<string, { label: string; hindi: string; className: string }> = {
  new: {
    label: "Submitted",
    hindi: "दर्ज",
    className: "bg-[color-mix(in_srgb,var(--color-indigo)_14%,transparent)] text-[var(--color-indigo)]",
  },
  in_progress: {
    label: "In progress",
    hindi: "प्रगति में",
    className: "bg-[color-mix(in_srgb,var(--color-marigold)_20%,transparent)] text-[var(--color-marigold-deep)]",
  },
  resolved: {
    label: "Resolved",
    hindi: "हल हुई",
    className: "bg-[color-mix(in_srgb,var(--color-sage)_18%,transparent)] text-[var(--color-sage)]",
  },
  rejected: {
    label: "Not taken up",
    hindi: "स्वीकृत नहीं",
    className: "bg-[color-mix(in_srgb,var(--color-terracotta)_14%,transparent)] text-[var(--color-terracotta)]",
  },
};

export function statusLabel(status: string, locale?: string): string {
  const s = STATUS_STYLES[status];
  if (!s) return status;
  return locale === "hi" ? s.hindi : s.label;
}

export function StatusBadge({ status, locale, className = "" }: { status: string; locale?: string; className?: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    hindi: status,
    className: "bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)] text-[var(--color-ink-soft)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style.className} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {locale === "hi" ? style.hindi : style.label}
    </span>
  );
}
