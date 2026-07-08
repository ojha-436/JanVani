"use client";

/* FAQ item on native <details>/<summary> — keyboard and screen-reader
   behavior for free. */

import { type ReactNode } from "react";

export function AccordionItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="card group px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
        {question}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-3 text-[0.97rem] leading-relaxed text-[var(--color-ink-soft)]">{children}</div>
    </details>
  );
}
