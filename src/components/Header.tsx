"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { ThemeToggle } from "@/lib/theme";

export function Header() {
  const { t } = useI18n();
  const { firebaseUser, profile } = useSession();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/#how", label: t.nav.how },
    { href: "/guide", label: t.nav.guide },
    { href: "/about", label: t.nav.about },
    ...(firebaseUser ? [{ href: "/my-complaints", label: t.nav.myComplaints }] : []),
  ];

  return (
    <header className="header-glass no-print sticky top-0 z-40 border-b border-[var(--color-line)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" aria-label="JanVaani home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[0.95rem] font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {firebaseUser ? (
            <Link
              href="/profile"
              className="hidden items-center gap-2 text-sm font-semibold text-[var(--color-ink)] hover:underline sm:inline-flex px-1"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-ink)] text-xs font-bold text-[var(--color-marigold)]">
                {(profile?.first_name?.[0] ?? "•").toUpperCase()}
              </span>
              {t.nav.profile}
            </Link>
          ) : (
            <Link href="/sign-in" className="hidden text-sm font-semibold text-[var(--color-ink)] hover:underline sm:inline-block px-2">
              {t.nav.signIn}
            </Link>
          )}
          <Link href="/submit" className="btn btn-marigold !py-2.5 !px-4 text-sm">
            {t.nav.submit}
          </Link>
          <button
            className="btn btn-ghost !p-2.5 !min-h-0 md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-[var(--color-line)] px-5 py-3 md:hidden">
          {[...links, firebaseUser ? { href: "/profile", label: t.nav.profile } : { href: "/sign-in", label: t.nav.signIn }].map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 font-medium text-[var(--color-ink-soft)]"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
