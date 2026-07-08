"use client";

/* MP dashboard alert bell. Polls GET /dashboard/alerts (high-confidence
   complaints, threshold applied server-side by fixed rules) once a
   minute — deliberately simple polling, no websockets, matching the
   dashboard's existing fetch-on-load architecture. "Seen" state lives in
   localStorage so the badge survives reloads without a backend table. */

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { getDashboardAlerts, type AlertOut } from "@/services/api";

const SEEN_KEY = "janvaani.alerts.seenAt";
const POLL_MS = 60_000;

export function NotificationBell({ className = "" }: { className?: string }) {
  const [alerts, setAlerts] = useState<AlertOut[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeenAt(localStorage.getItem(SEEN_KEY));
  }, []);

  const poll = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      setAlerts(await getDashboardAlerts(idToken));
    } catch {
      // Polling failures are silent — the next tick retries.
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unseen = alerts.filter((a) => !seenAt || a.created_at > seenAt).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && alerts.length > 0) {
      const latest = alerts[0].created_at;
      localStorage.setItem(SEEN_KEY, latest);
      setSeenAt(latest);
    }
  }

  return (
    <div ref={rootRef} className={`no-print relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Alerts${unseen ? ` (${unseen} new)` : ""}`}
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-line bg-field text-ink transition-colors hover:border-marigold-deep"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6ZM10 19a2.2 2.2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unseen > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-terracotta)] px-1 text-[10px] font-bold text-white">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-80 p-3 shadow-xl">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-ink-soft)]">
            Strong-evidence complaints · 24h
          </p>
          {alerts.length === 0 ? (
            <p className="px-2 pb-2 text-sm text-[var(--color-ink-soft)]">Nothing new — all quiet.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-lg px-2 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--color-ink)]">{a.category ?? "Uncategorized"}</span>
                    <span className="shrink-0 text-xs font-bold text-[var(--color-sage)]">
                      {a.verification_confidence != null ? `${a.verification_confidence}/100` : a.verification_status}
                    </span>
                  </div>
                  {a.location && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{a.location}</p>}
                  <p className="mt-0.5 text-xs text-[var(--color-ink-soft)] opacity-75">
                    {new Date(a.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
