"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/services/api";
import { Skeleton } from "./Skeleton";

let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.visualization) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

// Complaint categories are user/translation-driven, not a fixed enum, so
// colors are derived by hash rather than an explicit category->color map.
const PALETTE = ["#B64A34", "#D89A2B", "#4C7A5A", "#3B6E8F", "#8C5AA8", "#C1553B"];
function colorForCategory(category: string | null): string {
  if (!category) return "#6b6b6b";
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// Groups nearby points into grid cells sized so ~40px separates cells at
// the given zoom — a lightweight stand-in for a full clustering library,
// consistent with this component's "no npm map package" approach. Cells
// naturally shrink as the user zooms in, so clusters split apart on zoom.
function clusterPoints(points: MapPoint[], zoom: number) {
  const metersPerPixel = (156543.03392 * Math.cos((points[0]?.lat ?? 20) * (Math.PI / 180))) / 2 ** zoom;
  const cellDeg = Math.max((40 * metersPerPixel) / 111_320, 0.0005);

  const buckets = new Map<string, MapPoint[]>();
  for (const p of points) {
    const key = `${Math.round(p.lat / cellDeg)}_${Math.round(p.lng / cellDeg)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(p);
    else buckets.set(key, [p]);
  }
  return Array.from(buckets.values());
}

function buildInfoContent(point: MapPoint): HTMLElement {
  const div = document.createElement("div");
  div.style.fontSize = "13px";
  const strong = document.createElement("strong");
  strong.textContent = point.category || "Uncategorized";
  div.appendChild(strong);
  if (point.location) {
    div.appendChild(document.createElement("br"));
    div.appendChild(document.createTextNode(point.location));
  }
  return div;
}

export function HotspotMap({ points = [] }: { points?: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const zoomListenerAttached = useRef(false);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(12);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Map is not configured — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
      return;
    }
    if (!containerRef.current || points.length === 0) return;

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const g = window.google;
        if (!g) return;

        // Re-render on every `points`/`zoom`/`heatmap` change without leaking
        // the previous set of markers/heatmap layer.
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        heatmapRef.current?.setMap(null);
        heatmapRef.current = null;

        const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
        const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
        const map =
          mapRef.current ??
          new g.maps.Map(containerRef.current, {
            center: { lat: avgLat, lng: avgLng },
            zoom,
          });
        mapRef.current = map;

        if (!zoomListenerAttached.current) {
          zoomListenerAttached.current = true;
          map.addListener("zoom_changed", () => setZoom(map.getZoom()));
        }

        const infoWindow = new g.maps.InfoWindow();
        const clusters = clusterPoints(points, zoom);

        markersRef.current = clusters.map((group) => {
          const centerLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
          const centerLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
          const isCluster = group.length > 1;

          const marker = new g.maps.Marker({
            position: { lat: centerLat, lng: centerLng },
            map: heatmap ? null : map,
            title: isCluster ? `${group.length} complaints` : group[0].category || "Complaint",
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: isCluster ? 8 + Math.min(group.length, 20) : 8,
              fillColor: isCluster ? "#16221d" : colorForCategory(group[0].category),
              fillOpacity: 0.85,
              strokeColor: "#fff",
              strokeWeight: 1.5,
            },
            label: isCluster
              ? { text: String(group.length), color: "#fff", fontWeight: "700", fontSize: "12px" }
              : undefined,
            zIndex: isCluster ? 10 : 1,
          });

          marker.addListener("click", () => {
            if (isCluster) {
              map.setCenter({ lat: centerLat, lng: centerLng });
              map.setZoom(Math.min(zoom + 3, 20));
              return;
            }
            infoWindow.setContent(buildInfoContent(group[0]));
            infoWindow.open(map, marker);
          });
          return marker;
        });

        heatmapRef.current = new g.maps.visualization.HeatmapLayer({
          data: points.map((p) => new g.maps.LatLng(p.lat, p.lng)),
          radius: 40,
        });
        heatmapRef.current.setMap(heatmap ? map : null);
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load map"));

    return () => {
      cancelled = true;
    };
  }, [points, heatmap, zoom]);

  if (error) {
    return <p className="text-sm text-[var(--color-ink-soft)]">{error}</p>;
  }
  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--color-ink-soft)]">
        <span className="text-2xl" aria-hidden="true">
          📍
        </span>
        <p className="text-sm">No geotagged complaints yet.</p>
      </div>
    );
  }

  const categories = Array.from(new Set(points.map((p) => p.category).filter((c): c is string => Boolean(c))));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          {categories.map((c) => (
            <span key={c} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorForCategory(c) }} />
              {c}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold"
          onClick={() => setHeatmap((h) => !h)}
        >
          {heatmap ? "Show pins" : "Show hotspots"}
        </button>
      </div>
      {!ready && <Skeleton className="h-96 w-full" />}
      <div ref={containerRef} className={`h-96 w-full rounded-xl ${ready ? "" : "hidden"}`} />
    </div>
  );
}
