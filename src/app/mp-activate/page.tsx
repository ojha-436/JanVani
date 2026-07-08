"use client";

/* ------------------------------------------------------------------
   MP activation — the one-time invite link lands here.

   Resolves the invite token server-side (the constituency comes from the
   admin's allocation, never user input), marks it active, binds the
   constituency to the MP's session, and enters the dashboard.
   ------------------------------------------------------------------ */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { useSession } from "@/lib/profile";

type Resolved = { email: string; name: string; constituency: string; status: string };

export default function MpActivatePage() {
  const { signIn } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [rec, setRec] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    const tk = new URLSearchParams(window.location.search).get("token");
    if (!tk) {
      setError("This activation link is missing its token.");
      return;
    }
    setToken(tk);
    fetch(`/api/mp/resolve?token=${encodeURIComponent(tk)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRec({ email: d.email, name: d.name, constituency: d.constituency, status: d.status });
        else setError(d.reason === "no-db" ? "Accounts are unavailable in demo mode." : "This invite is invalid or has expired.");
      })
      .catch(() => setError("Could not verify this invite. Please try again."));
  }, []);

  async function enter() {
    if (!token || !rec) return;
    setEntering(true);
    try {
      await fetch("/api/mp/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {
      /* activation stamp is best-effort */
    }
    signIn({ method: "invite", role: "mp", email: rec.email, constituency: rec.constituency, at: new Date().toISOString() });
    window.location.href = "/dashboard";
  }

  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex" aria-label="JanVaani home">
          <Logo />
        </Link>

        {error ? (
          <div className="card mt-8 p-8">
            <p className="text-lg font-semibold text-[var(--color-terracotta)]">Activation failed</p>
            <p className="mt-2 text-[var(--color-ink-soft)]">{error}</p>
            <Link href="/sign-in?role=mp" className="btn btn-ghost mt-6">Go to sign in</Link>
          </div>
        ) : !rec ? (
          <p className="mt-10 text-[var(--color-ink-soft)]">Verifying your invite…</p>
        ) : (
          <div className="card mt-8 p-8">
            <p className="eyebrow text-[var(--color-terracotta)]">MP account activation</p>
            <h1 className="display-lg mt-2">Welcome{rec.name ? `, ${rec.name}` : ""}</h1>
            <p className="mt-3 text-[var(--color-ink-soft)]">
              You&apos;re being set up as the MP for
            </p>
            <p className="mt-1 font-display text-2xl" style={{ fontWeight: 560 }}>{rec.constituency}</p>
            <p className="mt-4 rounded-lg bg-[var(--color-paper-deep)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
              Signed in as <span className="font-semibold">{rec.email}</span>. Your dashboard will show only {rec.constituency}&apos;s citizen voices.
            </p>
            <button className="btn btn-marigold mt-6 w-full" onClick={enter} disabled={entering}>
              {entering ? "Entering…" : "Enter my dashboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
