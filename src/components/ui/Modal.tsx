"use client";

/* Dialog built on the native <dialog> element: focus trapping, Escape
   and backdrop-click close come from the platform instead of JS. */

import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Backdrop click: the dialog element itself is the target only
        // when the click lands outside the inner panel.
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-[min(92vw,34rem)] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper)] p-0 text-[var(--color-ink)] shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-sm ${className}`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[var(--color-ink-soft)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)] hover:text-[var(--color-ink)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
