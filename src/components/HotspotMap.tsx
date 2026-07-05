"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/services/api";

let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
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

export function HotspotMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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

        const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
        const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
        const map = new g.maps.Map(containerRef.current, {
          center: { lat: avgLat, lng: avgLng },
          zoom: 12,
        });
        const infoWindow = new g.maps.InfoWindow();

        points.forEach((p) => {
          const marker = new g.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            title: p.category || "Complaint",
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: colorForCategory(p.category),
              fillOpacity: 0.85,
              strokeColor: "#fff",
              strokeWeight: 1.5,
            },
          });
          marker.addListener("click", () => {
            infoWindow.setContent(
              `<div style="font-size:13px"><strong>${p.category || "Uncategorized"}</strong><br/>${p.location || ""}</div>`
            );
            infoWindow.open(map, marker);
          });
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load map"));

    return () => {
      cancelled = true;
    };
  }, [points]);

  if (error) {
    return <p className="text-sm text-[var(--color-ink-soft)]">{error}</p>;
  }
  if (points.length === 0) {
    return <p className="text-sm text-[var(--color-ink-soft)]">No geotagged complaints yet.</p>;
  }
  return <div ref={containerRef} className="h-96 w-full rounded-xl" />;
}
