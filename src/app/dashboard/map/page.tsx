"use client";

/* Dashboard · Map — the hotspot view on its own route. */

import { useEffect, useState } from "react";
import { HotspotMap } from "@/components/HotspotMap";
import { SkeletonCard } from "@/components/Skeleton";
import { auth } from "@/lib/firebase";
import { getDashboardSummary, type MapPoint } from "@/services/api";
import { DashboardError } from "../shared";

export default function DashboardMapPage() {
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      const summary = await getDashboardSummary(idToken, { recentLimit: 1 });
      setPoints(summary.map_points ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load map data");
    }
  }

  useEffect(() => {
    if (auth?.currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mt-8">
      <p className="eyebrow text-[var(--color-ink-soft)]">Hotspot map</p>
      {error && <DashboardError message={error} onRetry={load} />}
      {points === null && !error ? (
        <div className="mt-4">
          <SkeletonCard lines={6} />
        </div>
      ) : points && points.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-[var(--color-ink-soft)]">
          No geo-tagged complaints yet — once citizens attach a location, hotspots appear here.
        </div>
      ) : (
        points && (
          <div className="card mt-4 overflow-hidden p-2">
            <HotspotMap points={points} />
          </div>
        )
      )}
    </section>
  );
}
