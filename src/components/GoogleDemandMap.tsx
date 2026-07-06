"use client";

/* ------------------------------------------------------------------
   Google Maps version of the demand map (used when
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set). Same behaviour as the SVG
   fallback: aggregate bubbles per area when zoomed out, individual
   category-coloured query markers when zoomed in, click → detail.

   If the Maps API fails to load (bad/missing key, network, quota) it
   calls onError so the parent can fall back to the SVG map.
   ------------------------------------------------------------------ */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from "react";
import { AREA_CENTROIDS } from "@/lib/publicData";
import { CATEGORY_ORDER, CATEGORY_COLOR, categoryHex, type PublicSubmission } from "@/lib/sampleData";

const DETAIL_ZOOM = 12; // at/above this zoom, show individual query markers

declare global {
  interface Window {
    google?: any;
    __janvaaniMapsCb?: () => void;
  }
}

let mapsPromise: Promise<any> | null = null;

function loadMaps(key: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    window.__janvaaniMapsCb = () => resolve(window.google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__janvaaniMapsCb`;
    s.async = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("maps-load-failed"));
    };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

function centerOfConstituency() {
  const cs = Object.values(AREA_CENTROIDS);
  const lat = cs.reduce((a, c) => a + c.lat, 0) / cs.length;
  const lng = cs.reduce((a, c) => a + c.lng, 0) / cs.length;
  return { lat, lng };
}

export function GoogleDemandMap({
  submissions,
  apiKey,
  onSelect,
  onError,
}: {
  submissions: PublicSubmission[];
  apiKey: string;
  onSelect: (s: PublicSubmission) => void;
  onError: () => void;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const subsRef = useRef(submissions);
  subsRef.current = submissions;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;

    loadMaps(apiKey)
      .then((maps) => {
        if (cancelled || !divRef.current) return;
        const map = new maps.Map(divRef.current, {
          center: centerOfConstituency(),
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapRef.current = map;

        const clear = () => {
          markersRef.current.forEach((m) => m.setMap(null));
          markersRef.current = [];
        };

        const render = () => {
          if (!mapRef.current) return;
          clear();
          const zoom = map.getZoom() ?? 10;
          const subs = subsRef.current;

          if (zoom < DETAIL_ZOOM) {
            // aggregate: one bubble per area, sized + labelled by count
            const agg = new Map<string, { count: number; cats: Map<string, number> }>();
            for (const s of subs) {
              if (!agg.has(s.area)) agg.set(s.area, { count: 0, cats: new Map() });
              const e = agg.get(s.area)!;
              e.count++;
              e.cats.set(s.category, (e.cats.get(s.category) ?? 0) + 1);
            }
            const max = Math.max(1, ...[...agg.values()].map((e) => e.count));
            for (const [area, e] of agg) {
              const c = AREA_CENTROIDS[area];
              if (!c) continue;
              const topCat = [...e.cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Other";
              const r = Math.round(16 + 20 * (e.count / max));
              const size = r * 2;
              const svg =
                `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
                `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="${categoryHex(topCat)}" fill-opacity="0.9" stroke="#fffdf8" stroke-width="2"/></svg>`;
              const marker = new maps.Marker({
                position: c,
                map,
                title: `${area}: ${e.count} queries`,
                icon: {
                  url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
                  scaledSize: new maps.Size(size, size),
                  anchor: new maps.Point(r, r),
                  labelOrigin: new maps.Point(r, r),
                },
                label: { text: String(e.count), color: "#fffdf8", fontWeight: "700", fontSize: "13px" },
              });
              marker.addListener("click", () => {
                map.setZoom(13);
                map.panTo(c);
              });
              markersRef.current.push(marker);
            }
          } else {
            // individual query markers, coloured by category
            for (const s of subs) {
              const marker = new maps.Marker({
                position: s.coords,
                map,
                title: `${s.category} · ${s.area}`,
                icon: {
                  path: maps.SymbolPath.CIRCLE,
                  scale: 7,
                  fillColor: categoryHex(s.category),
                  fillOpacity: 1,
                  strokeColor: "#fffdf8",
                  strokeWeight: 1.5,
                },
              });
              marker.addListener("click", () => onSelectRef.current(s));
              markersRef.current.push(marker);
            }
          }
        };

        render();
        map.addListener("zoom_changed", render);
        // expose render so the submissions effect can refresh markers
        (mapRef.current as any).__render = render;
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // redraw markers when the submissions change
  useEffect(() => {
    const r = mapRef.current?.__render;
    if (r) r();
  }, [submissions]);

  return (
    <div className="relative">
      <div ref={divRef} className="w-full overflow-hidden rounded-xl" style={{ height: 520, background: "var(--color-paper-deep)" }} />
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-[rgba(22,34,29,0.82)] px-3 py-1 text-xs font-semibold text-[var(--color-paper)]">
        Zoom in for individual queries — click a marker for detail
      </div>
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
