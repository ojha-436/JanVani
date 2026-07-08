"use client";

/* Dashboard shell: MP auth gating, sticky header (theme toggle, alert
   bell, menu), section tabs and the print-report chrome. Each section is
   its own route so an MP can deep-link straight to Complaints or the Map. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { CONSTITUENCY_LABEL } from "./shared";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/complaints", label: "Complaints" },
  { href: "/dashboard/map", label: "Map" },
  { href: "/dashboard/progress", label: "Progress" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { ready, firebaseUser, isMp } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!firebaseUser) {
      window.location.href = "/sign-in?role=mp";
      return;
    }
    if (!isMp) {
      window.location.href = "/";
    }
  }, [ready, firebaseUser, isMp]);

  if (!ready || !firebaseUser || !isMp) return null;

  return (
    <div className="min-h-dvh">
      <header className="header-glass no-print sticky top-0 z-40 border-b border-[var(--color-line)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" aria-label="JanVaani home">
            <Logo size={30} />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <div className="relative">
              <button
                className="btn btn-ghost !p-2.5 !min-h-0"
                aria-label="Menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              {menuOpen && (
                <ul role="menu" className="card absolute right-0 mt-2 w-56 overflow-hidden p-1.5 z-50 shadow-xl">
                  <li>
                    <Link
                      href="/gov-data"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[var(--color-line)]"
                    >
                      Update gov data
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-4xl px-5 py-12">
        <div className="print-only mb-4">
          <p className="text-sm font-bold">JanVaani — Constituency field report</p>
          <p className="text-xs">Generated {new Date().toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-[var(--color-terracotta)]">{t.dash.badge}</p>
            <h1 className="display-lg mt-2">{CONSTITUENCY_LABEL}</h1>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-ghost no-print !py-2.5 !px-4 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 8V4h10v4M7 17h10v4H7v-4Zm-3-9h16a1 1 0 0 1 1 1v7h-4M3 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 9v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Print report
          </button>
        </div>

        <nav aria-label="Dashboard sections" className="no-print mt-6 flex flex-wrap gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-field)] p-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  active
                    ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </main>
    </div>
  );
}
