"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();

  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: t.nav.home,
      links: [
        { href: "/submit", label: t.nav.submit },
        { href: "/my-complaints", label: t.nav.myComplaints },
        { href: "/guide", label: t.nav.guide },
      ],
    },
    {
      title: t.nav.impact,
      links: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/gov-data", label: "Gov data" },
        { href: "/sign-in", label: t.nav.signIn },
      ],
    },
    {
      title: t.nav.about,
      links: [
        { href: "/about", label: t.nav.about },
        { href: "/guide#faq", label: "FAQ" },
      ],
    },
  ];

  return (
    <footer className="no-print mt-24 border-t border-[var(--color-line)]">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-[var(--color-ink-soft)]">{t.footer.tagline}</p>
            <p className="mt-1.5 text-sm text-[var(--color-ink-soft)] opacity-80">{t.footer.built}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title} className="text-sm">
                <p className="eyebrow mb-3 text-[var(--color-ink-soft)]">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 text-sm text-[var(--color-ink-soft)] opacity-80 sm:flex-row sm:items-center sm:justify-between">
          <div className="rule-ledger w-40" />
          <p>
            {t.footer.rights} · © {new Date().getFullYear()} JanVaani
          </p>
        </div>
      </div>
    </footer>
  );
}
