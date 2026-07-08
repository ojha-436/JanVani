"use client";

/* Compact read-only map for the submit flow: shows issues already
   reported near the citizen's chosen location. Presentational only —
   the caller fetches the (anonymized) points. Falls back to a plain
   category summary when no Maps API key is configured, so the feature
   degrades to text instead of disappearing. */

import { useEffect, useRef, useState } from "react";
import type { NearbyComplaintOut } from "@/services/api";

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

function statusColor(status: string): string {
  switch (status) {
    case "resolved":
      return "#4f6f60";
    case "in_progress":
      return "#c67d0a";
    default:
      return "#b64a34";
  }
}

export function MiniMap({
  center,
  points,
  className = "",
}: {
  center: { lat: number; lng: number };
  points: NearbyComplaintOut[];
  className?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;
    const markers: google.maps.Marker[] = [];
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });
        new google.maps.Marker({
          position: center,
          map,
          title: "You",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#263a63",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        for (const p of points) {
          markers.push(
            new google.maps.Marker({
              position: { lat: p.lat, lng: p.lng },
              map,
              title: p.category ?? "Issue",
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: statusColor(p.status),
                fillOpacity: 0.85,
                strokeColor: "#ffffff",
                strokeWeight: 1.5,
              },
            })
          );
        }
      })
      .catch(() => setMapFailed(true));
    return () => {
      cancelled = true;
      markers.forEach((m) => m.setMap(null));
    };
  }, [apiKey, center, points]);

  const byCategory = new Map<string, number>();
  for (const p of points) {
    const key = p.category ?? "Other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  }

  return (
    <div className={className}>
      {apiKey && !mapFailed && (
        <div
          ref={mapRef}
          role="img"
          aria-label={`Map of ${points.length} issues reported nearby`}
          className="h-52 w-full overflow-hidden rounded-[var(--radius)] border border-[var(--color-line)]"
        />
      )}
      {points.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from(byCategory.entries()).map(([cat, n]) => (
            <span key={cat} className="chip !py-1 text-xs">
              {cat} · {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
