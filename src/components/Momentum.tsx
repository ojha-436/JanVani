"use client";

/* ------------------------------------------------------------------
   Momentum UI: a compact volume sparkline + a rising/falling/flat
   badge, shared by the ranked work cards and the recurring-needs list.
   Turns each frozen number into a trend an MP can act on.
   ------------------------------------------------------------------ */

import type { Trend, TrendDirection } from "@/lib/dashboardData";

const DIR_COLOR: Record<TrendDirection, string> = {
  rising: "var(--color-terracotta)",
  falling: "var(--color-sage)",
  flat: "var(--color-ink-soft)",
};

const DIR_ARROW: Record<TrendDirection, string> = { rising: "▲", falling: "▼", flat: "▬" };

/** Tiny inline sparkline (no deps). Colour follows the trend direction. */
export function Sparkline({ spark, direction, width = 72, height = 22 }: { spark: number[]; direction: TrendDirection; width?: number; height?: number }) {
  if (!spark || spark.length < 2) return null;
  const max = Math.max(1, ...spark);
  const stepX = width / (spark.length - 1);
  const pts = spark.map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * (height - 3) - 1.5).toFixed(1)}`);
  const color = DIR_COLOR[direction];
  const areaPath = `M0,${height} L${pts.join(" L")} L${width},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ overflow: "visible" }}>
      <path d={areaPath} fill={color} opacity={0.12} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - (spark[spark.length - 1] / max) * (height - 3) - 1.5} r={2.1} fill={color} />
    </svg>
  );
}

/** Rising / falling / flat pill with the signed % change. */
export function TrendBadge({ trend, showSpark = false }: { trend?: Trend; showSpark?: boolean }) {
  if (!trend) return null;
  const color = DIR_COLOR[trend.direction];
  const label =
    trend.direction === "flat"
      ? "Steady"
      : `${trend.changePct > 0 ? "+" : ""}${trend.changePct}% ${trend.direction === "rising" ? "rising" : "falling"}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      {showSpark && <Sparkline spark={trend.spark} direction={trend.direction} />}
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}>
        <span aria-hidden>{DIR_ARROW[trend.direction]}</span>
        {label}
      </span>
    </span>
  );
}
