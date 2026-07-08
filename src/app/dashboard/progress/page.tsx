"use client";

/* Dashboard · Progress — status funnel and per-department breakdown. */

import { useEffect, useState } from "react";
import { SkeletonCard } from "@/components/Skeleton";
import { auth } from "@/lib/firebase";
import { getDashboardProgress, type ProgressOut } from "@/services/api";
import { DashboardError, ProgressTracker, STATUS_LABEL, fmt } from "../shared";

export default function DashboardProgressPage() {
  const [progress, setProgress] = useState<ProgressOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      setProgress(await getDashboardProgress(idToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load progress data");
    }
  }

  useEffect(() => {
    if (auth?.currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <DashboardError message={error} onRetry={load} />;
  if (!progress)
    return (
      <div className="mt-8">
        <SkeletonCard lines={5} />
      </div>
    );

  const last30 = progress.by_status_last_30_days;
  const last30Total = last30.reduce((s, c) => s + c.count, 0);

  return (
    <>
      <ProgressTracker progress={progress} />
      {last30Total > 0 && (
        <section className="mt-6">
          <p className="eyebrow text-[var(--color-ink-soft)]">Last 30 days</p>
          <div className="card mt-4 flex flex-wrap gap-6 p-6 text-sm">
            {last30.map((c) => (
              <span key={c.status}>
                <strong className="text-lg">{fmt(c.count)}</strong>{" "}
                <span className="text-[var(--color-ink-soft)]">{STATUS_LABEL[c.status] ?? c.status}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
