"use client";

/* Vertical progress timeline for a complaint's journey
   (Submitted → In progress → Resolved). Events come from real recorded
   status transitions (status_notifications rows) plus the creation
   time — nothing is inferred. */

export type TimelineEvent = {
  label: string;
  at?: string | null;
  detail?: string;
  state: "done" | "current" | "pending";
};

function dot(state: TimelineEvent["state"]): string {
  switch (state) {
    case "done":
      return "border-[var(--color-sage)] bg-[var(--color-sage)]";
    case "current":
      return "border-[var(--color-marigold-deep)] bg-[var(--color-marigold)]";
    default:
      return "border-[var(--color-line)] bg-transparent";
  }
}

export function StatusTimeline({ events, className = "" }: { events: TimelineEvent[]; className?: string }) {
  if (events.length === 0) return null;
  return (
    <ol className={`relative ${className}`}>
      {events.map((e, i) => (
        <li key={`${e.label}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && (
            <span
              aria-hidden="true"
              className={`absolute left-[7px] top-4 h-full w-0.5 ${
                e.state === "done" ? "bg-[var(--color-sage)]" : "bg-[var(--color-line)]"
              }`}
            />
          )}
          <span
            aria-hidden="true"
            className={`relative z-10 mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${dot(e.state)}`}
          />
          <div className="min-w-0">
            <p
              className={`text-sm font-bold leading-tight ${
                e.state === "pending" ? "text-[var(--color-ink-soft)] opacity-60" : "text-[var(--color-ink)]"
              }`}
            >
              {e.label}
            </p>
            {e.at && (
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                {new Date(e.at).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            {e.detail && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
