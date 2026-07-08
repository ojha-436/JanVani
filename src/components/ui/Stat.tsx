"use client";

/* KPI tile: big number, label, optional period-over-period delta.
   The delta is displayed exactly as computed by the caller from real
   backend counts — this component does no math beyond sign checks. */

export function Stat({
  value,
  label,
  delta,
  deltaLabel,
  className = "",
}: {
  value: string | number;
  label: string;
  delta?: number | null;
  deltaLabel?: string;
  className?: string;
}) {
  const showDelta = delta != null && Number.isFinite(delta);
  const up = showDelta && delta! > 0;
  const flat = showDelta && delta === 0;
  return (
    <div className={`card p-5 ${className}`}>
      <p className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
      <p className="mt-1 text-sm font-medium text-[var(--color-ink-soft)]">{label}</p>
      {showDelta && (
        <p
          className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${
            flat
              ? "text-[var(--color-ink-soft)]"
              : up
                ? "text-[var(--color-terracotta)]"
                : "text-[var(--color-sage)]"
          }`}
        >
          <span aria-hidden="true">{flat ? "→" : up ? "↑" : "↓"}</span>
          {Math.abs(delta!)}
          {deltaLabel ? ` ${deltaLabel}` : ""}
        </p>
      )}
    </div>
  );
}
