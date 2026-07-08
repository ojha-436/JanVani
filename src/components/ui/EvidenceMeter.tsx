"use client";

/* Visualizes a verification/evidence score (0–100) computed by the
   backend's fixed rules (backend/app/verification.py, evidence.py).
   This component NEVER computes or adjusts the number — it only draws
   what the server said, per the project's core rule. */

function levelColor(level: string | null): string {
  switch ((level ?? "").toLowerCase()) {
    case "strong":
    case "high":
      return "var(--color-sage)";
    case "moderate":
    case "medium":
      return "var(--color-marigold-deep)";
    default:
      return "var(--color-terracotta)";
  }
}

export function EvidenceMeter({
  score,
  level,
  className = "",
}: {
  score: number | null;
  level: string | null;
  className?: string;
}) {
  if (score == null) return null;
  const clamped = Math.max(0, Math.min(100, score));
  const color = levelColor(level);
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={`Evidence strength ${clamped} out of 100${level ? `, ${level}` : ""}`}
        className="h-2 w-28 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold" style={{ color }}>
        {level ?? `${clamped}/100`}
      </span>
    </div>
  );
}
