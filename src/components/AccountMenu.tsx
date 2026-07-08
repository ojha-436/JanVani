"use client";

/* ------------------------------------------------------------------
   Account menu — the full-screen menu the header's ☰ button opens.

   Rendered through a portal to <body> (NOT inside the header) because the
   header uses backdrop-blur, which creates a containing block that would
   otherwise trap a position:fixed overlay inside the header strip. As a
   body-level portal it covers the whole page, like a normal mobile menu.

   Merges the citizen's profile with "Your queries": every need they
   raised and the action the MP has taken on it (matched to the ranked
   work's status — the same status shown on the public board).
   ------------------------------------------------------------------ */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { useSession, maskAadhaar } from "@/lib/profile";
import { getQueries, type LocalQuery } from "@/lib/queries";
import { STATUS_META, WORK_STATUSES, type WorkStatusValue } from "@/lib/dashboardData";

export function AccountMenu({ open, onClose, navLinks }: { open: boolean; onClose: () => void; navLinks: { href: string; label: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const { session, profile, signOut } = useSession();

  const [mounted, setMounted] = useState(false);
  const [queries, setQueries] = useState<LocalQuery[]>([]);
  const [statusById, setStatusById] = useState<Record<string, WorkStatusValue>>({});

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQueries(getQueries());
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.items)) {
          const m: Record<string, WorkStatusValue> = {};
          for (const it of d.items) if (WORK_STATUSES.includes(it.status)) m[it.id] = it.status;
          setStatusById(m);
        }
      })
      .catch(() => {});
  }, [open]);

  // Lock body scroll + close on Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
  const initial = (profile?.firstName?.[0] ?? session?.email?.[0] ?? "•").toUpperCase();

  function handleSignOut() {
    signOut();
    onClose();
    router.push("/");
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--color-paper)]" role="dialog" aria-modal="true" aria-label="Menu">
      {/* top bar */}
      <div className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[rgba(246,241,231,0.9)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-base font-bold text-[var(--color-marigold)]">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-tight" style={{ fontWeight: 560 }}>
                {session ? name || "Your account" : "Menu"}
              </p>
              {session?.email && <p className="truncate text-xs text-[var(--color-ink-soft)]">{session.email}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line)] text-2xl leading-none text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {session ? (
          <div className="grid gap-8 md:grid-cols-2">
            {/* profile */}
            <section>
              <h2 className="eyebrow text-[var(--color-terracotta)]">Your profile</h2>
              <div className="card mt-3 p-5">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <Detail label="Name" value={name || "Not set"} />
                  <Detail label="Constituency" value={profile?.constituency || "Not set"} />
                  <Detail label="Current address" value={profile?.address || "Not set"} full />
                  <Detail label="State / UT" value={profile?.state || "Not set"} />
                  <Detail label="PIN code" value={profile?.pincode || "Not set"} />
                  <Detail label="Aadhaar" value={maskAadhaar(profile?.aadhaar) || "Not set"} />
                </dl>
                <Link href="/profile" onClick={onClose} className="mt-4 inline-block text-sm font-semibold underline">
                  View / edit full profile
                </Link>
              </div>
            </section>

            {/* your queries */}
            <section>
              <h2 className="eyebrow text-[var(--color-terracotta)]">Your queries</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">The needs you raised, and what your MP has done.</p>
              {queries.length === 0 ? (
                <div className="card mt-3 p-5 text-sm text-[var(--color-ink-soft)]">
                  You haven&apos;t raised a query on this device yet.{" "}
                  <Link href="/submit" onClick={onClose} className="font-semibold text-[var(--color-ink)] underline">
                    Raise your voice
                  </Link>
                  .
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {queries.map((q) => {
                    const status = statusById[q.workId] ?? "new";
                    const meta = STATUS_META[status];
                    return (
                      <li key={q.id} className="card p-4">
                        <p className="text-sm font-medium leading-snug">“{q.need_en}”</p>
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="text-xs text-[var(--color-ink-soft)]">
                            {q.category}
                            {q.area ? ` · ${q.area}` : ""}
                          </span>
                          <span
                            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                            style={{ color: meta.color, backgroundColor: `color-mix(in srgb, ${meta.color} 15%, transparent)` }}
                          >
                            {meta.citizenLabel}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <section className="mx-auto max-w-md text-center">
            <p className="text-[var(--color-ink-soft)]">Sign in to raise a query and track your MP&apos;s response.</p>
            <Link href="/sign-in" onClick={onClose} className="btn btn-primary mt-4 w-full">
              {t.nav.signIn}
            </Link>
          </section>
        )}

        {/* navigation + actions */}
        <div className="mt-10 border-t border-[var(--color-line)] pt-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={onClose} className="font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]">
                {l.label}
              </a>
            ))}
            <Link href="/status" onClick={onClose} className="font-medium text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]">
              Action taken (public board)
            </Link>
          </nav>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/submit" onClick={onClose} className="btn btn-marigold flex-1 text-center">
              {t.nav.submit}
            </Link>
            {session && (
              <button
                onClick={handleSignOut}
                className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm font-semibold transition-colors hover:border-[var(--color-terracotta)] hover:text-[var(--color-terracotta)]"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Detail({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 min-w-0" : "min-w-0"}>
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
