"use client";

import Link from "next/link";

export function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
  className = "",
}: {
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <div className="rule-ledger mb-5 w-24" />
      <p className="font-display text-xl font-semibold text-[var(--color-ink)]">{title}</p>
      {body && <p className="mt-2 max-w-sm text-[var(--color-ink-soft)]">{body}</p>}
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="btn btn-marigold mt-6 text-sm">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
