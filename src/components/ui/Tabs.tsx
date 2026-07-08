"use client";

/* Accessible tabs (roving tabindex, arrow-key navigation). */

import { useId, useRef, useState, type ReactNode } from "react";

export function Tabs({
  tabs,
  initial = 0,
  className = "",
}: {
  tabs: { label: string; content: ReactNode }[];
  initial?: number;
  className?: string;
}) {
  const [active, setActive] = useState(Math.min(initial, tabs.length - 1));
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = (active + delta + tabs.length) % tabs.length;
    setActive(next);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[next]?.focus();
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-field)] p-1"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              i === active
                ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.label}
          role="tabpanel"
          id={`${baseId}-panel-${i}`}
          aria-labelledby={`${baseId}-tab-${i}`}
          hidden={i !== active}
          className="mt-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
