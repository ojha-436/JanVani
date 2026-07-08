"use client";

/* ------------------------------------------------------------------
   Interactive demand map.

   A zoom/pan geographic view of citizen demand across the constituency:
   - zoomed out → one bubble per area sized by number of queries (the
     "how many voices, where" view);
   - zoom in (buttons, scroll, or click a bubble) → the bubbles resolve
     into individual submission points, coloured by category;
   - click a point → the full submission detail opens.

   Rendered as SVG so it works everywhere with no Maps API key. Setting
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is the documented upgrade to Google
   Maps tiles (ARCHITECTURE.md §6.2); the data + interactions are identical.
   ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AREA_CENTROIDS, resolveAreaName } from "@/lib/publicData";
import { CATEGORY_COLOR, CATEGORY_ORDER, type PublicSubmission } from "@/lib/sampleData";
import { GoogleDemandMap } from "./GoogleDemandMap";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Demand map switcher: renders Google Maps when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * is configured (falling back to the built-in SVG map if it fails to load),
 * otherwise the dependency-free SVG map. Both share the same data + detail flow.
 */
export function DemandMap(props: { submissions: PublicSubmission[]; onSelect: (s: PublicSubmission) => void }) {
  const [useGoogle, setUseGoogle] = useState(Boolean(MAPS_KEY));
  if (useGoogle && MAPS_KEY) {
    return (
      <GoogleDemandMap
        submissions={props.submissions}
        apiKey={MAPS_KEY}
        onSelect={props.onSelect}
        onError={() => setUseGoogle(false)}
      />
    );
  }
  return <SvgDemandMap {...props} />;
}

const W = 820;
const H = 520;
const MARGIN = 60;
const DETAIL_ZOOM = 2.2; // scale at/above which individual points show
const MIN_S = 1;
const MAX_S = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type AreaAgg = { name: string; count: number; topCat: string; x: number; y: number };

function SvgDemandMap({
  submissions,
  onSelect,
}: {
  submissions: PublicSubmission[];
  onSelect: (s: PublicSubmission) => void;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  // Projection bounds derived from the actual submissions (so queries anywhere
  // are in-frame), falling back to the constituency centroids when there's no
  // usable GPS. Padded so points aren't flush against the edge.
  const bounds = useMemo(() => {
    const lats: number[] = [];
    const lngs: number[] = [];
    for (const s of submissions) {
      if (Number.isFinite(s.coords?.lat) && Number.isFinite(s.coords?.lng)) {
        lats.push(s.coords.lat);
        lngs.push(s.coords.lng);
      }
    }
    if (lats.length < 2) {
      for (const c of Object.values(AREA_CENTROIDS)) {
        lats.push(c.lat);
        lngs.push(c.lng);
      }
    }
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padLat = (maxLat - minLat || 0.1) * 0.12;
    const padLng = (maxLng - minLng || 0.1) * 0.12;
    return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
  }, [submissions]);

  const project = useCallback(
    (lng: number, lat: number): [number, number] => {
      const x = MARGIN + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1)) * (W - 2 * MARGIN);
      const y = MARGIN + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat || 1)) * (H - 2 * MARGIN);
      return [x, y];
    },
    [bounds]
  );

  // ---- aggregates per area, positioned at the mean of member coords ----
  const { areas, maxCount } = useMemo(() => {
    const m = new Map<string, { count: number; cats: Map<string, number>; latSum: number; lngSum: number }>();
    for (const s of submissions) {
      const area = resolveAreaName(s.area);
      if (!m.has(area)) m.set(area, { count: 0, cats: new Map(), latSum: 0, lngSum: 0 });
      const e = m.get(area)!;
      e.count++;
      e.cats.set(s.category, (e.cats.get(s.category) ?? 0) + 1);
      e.latSum += s.coords.lat;
      e.lngSum += s.coords.lng;
    }
    const areas: AreaAgg[] = [];
    for (const [name, e] of m) {
      const [x, y] = project(e.lngSum / e.count, e.latSum / e.count);
      const topCat = [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Other";
      areas.push({ name, count: e.count, topCat, x, y });
    }
    return { areas, maxCount: Math.max(1, ...areas.map((a) => a.count)) };
  }, [submissions, project]);

  // Pre-project individual points (transform applied at render time).
  const points = useMemo(
    () => submissions.map((s) => ({ s, base: project(s.coords.lng, s.coords.lat) })),
    [submissions, project]
  );

  const toScreen = (bx: number, by: number): [number, number] => [bx * scale + tx, by * scale + ty];

  function setZoom(next: number, cx = W / 2, cy = H / 2) {
    const s2 = clamp(next, MIN_S, MAX_S);
    // keep the point under (cx,cy) fixed while zooming
    const bx = (cx - tx) / scale;
    const by = (cy - ty) / scale;
    setScale(s2);
    setTx(cx - bx * s2);
    setTy(cy - by * s2);
  }

  function zoomToArea(a: AreaAgg) {
    const s2 = 3.6;
    setScale(s2);
    setTx(W / 2 - a.x * s2);
    setTy(H / 2 - a.y * s2);
  }

  function reset() {
    setScale(1);
    setTx(0);
    setTy(0);
  }

  // Native wheel listener so we can preventDefault (avoid page scroll).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * W;
      const cy = ((e.clientY - rect.top) / rect.height) * H;
      setZoom(scale * (e.deltaY < 0 ? 1.18 : 0.85), cx, cy);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, tx, ty]);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Only pan when the drag starts on the map background — never on a
    // marker, so clicking a point always registers as a click.
    const tag = (e.target as Element).tagName.toLowerCase();
    if (tag !== "svg" && tag !== "rect") return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / rect.width) * W;
    const dy = ((e.clientY - drag.current.y) / rect.height) * H;
    setTx(drag.current.tx + dx);
    setTy(drag.current.ty + dy);
  }
  function onPointerUp() {
    drag.current = null;
  }

  const showPoints = scale >= DETAIL_ZOOM;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none rounded-xl"
        style={{ background: "var(--color-paper-deep)", cursor: drag.current ? "grabbing" : "grab", aspectRatio: `${W} / ${H}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label="Demand map of the constituency"
      >
        {/* subtle graticule */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0 H0 V40" fill="none" stroke="var(--color-line)" strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#grid)" />

        {/* area heat zones */}
        {areas.map((a) => {
          const [sx, sy] = toScreen(a.x, a.y);
          const norm = a.count / maxCount;
          const r = (26 + 44 * norm) * clamp(scale * 0.7, 0.7, 3.2);
          return (
            <circle
              key={`zone-${a.name}`}
              cx={sx}
              cy={sy}
              r={r}
              fill={CATEGORY_COLOR[a.topCat] ?? "var(--color-marigold)"}
              opacity={0.16}
            />
          );
        })}

        {/* aggregate bubbles (zoomed out) */}
        {!showPoints &&
          areas.map((a) => {
            const [sx, sy] = toScreen(a.x, a.y);
            const norm = a.count / maxCount;
            const r = 16 + 22 * norm;
            return (
              <g key={`agg-${a.name}`} style={{ cursor: "pointer" }} onClick={() => zoomToArea(a)}>
                <circle cx={sx} cy={sy} r={r} fill={CATEGORY_COLOR[a.topCat] ?? "var(--color-marigold)"} opacity={0.92} />
                <text x={sx} y={sy + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fffdf8">
                  {a.count}
                </text>
                <text x={sx} y={sy + r + 15} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink)">
                  {a.name}
                </text>
              </g>
            );
          })}

        {/* individual points (zoomed in) */}
        {showPoints &&
          points.map(({ s, base }) => {
            const [sx, sy] = toScreen(base[0], base[1]);
            if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) return null; // cull
            return (
              <circle
                key={s.id}
                cx={sx}
                cy={sy}
                r={6}
                fill={CATEGORY_COLOR[s.category] ?? "var(--color-marigold)"}
                stroke="#fffdf8"
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(s);
                }}
              >
                <title>{`${s.category} · ${s.area}`}</title>
              </circle>
            );
          })}

        {/* area labels when zoomed in */}
        {showPoints &&
          areas.map((a) => {
            const [sx, sy] = toScreen(a.x, a.y);
            return (
              <text key={`lbl-${a.name}`} x={sx} y={sy - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-ink)" opacity={0.55}>
                {a.name}
              </text>
            );
          })}
      </svg>

      {/* zoom controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <MapBtn label="Zoom in" onClick={() => setZoom(scale * 1.4)}>+</MapBtn>
        <MapBtn label="Zoom out" onClick={() => setZoom(scale / 1.4)}>−</MapBtn>
        <MapBtn label="Reset view" onClick={reset}>⟳</MapBtn>
      </div>

      {/* mode hint */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-[rgba(22,34,29,0.82)] px-3 py-1 text-xs font-semibold text-[var(--color-paper)]">
        {showPoints ? "Showing individual queries — click a point" : "Query counts by area — click a bubble to drill in"}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {CATEGORY_ORDER.map((c) => (
          <span key={c} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[c] }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function MapBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] text-lg font-bold shadow-sm transition-colors hover:border-[var(--color-ink-soft)]"
    >
      {children}
    </button>
  );
}
