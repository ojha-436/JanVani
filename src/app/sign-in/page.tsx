"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { syncUser } from "@/services/api";

type Role = "citizen" | "mp";
type Step = "phone" | "otp";

export default function SignInPage() {
  const { t } = useI18n();
  const [role, setRole] = useState<Role>("citizen");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Read ?role=mp without needing a Suspense boundary.
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("role");
    if (r === "mp") setRole("mp");
  }, []);

  async function trySyncUser() {
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      await syncUser(idToken);
    } catch (e) {
      console.error("Failed to sync user with backend", e);
    }
  }

  function requireConfig(): boolean {
    if (!isFirebaseConfigured || !auth) {
      setNotice(
        "Demo mode — add your Firebase keys to .env.local to enable live sign-in. The flow and UI are fully wired."
      );
      return false;
    }
    return true;
  }

  async function sendOtp() {
    setNotice(null);
    if (!requireConfig()) return;
    setBusy(true);
    try {
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      const verifier = new RecaptchaVerifier(auth!, "recaptcha-container", { size: "invisible" });
      const confirmation = await signInWithPhoneNumber(auth!, normalizePhone(phone), verifier);
      (window as unknown as { _confirm: unknown })._confirm = confirmation;
      setStep("otp");
    } catch (e) {
      setNotice(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setNotice(null);
    setBusy(true);
    try {
      const confirmation = (window as unknown as { _confirm?: { confirm: (c: string) => Promise<unknown> } })._confirm;
      if (!confirmation) throw new Error("Please request an OTP first.");
      await confirmation.confirm(otp);
      await trySyncUser();
      window.location.href = "/submit";
    } catch (e) {
      setNotice(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setNotice(null);
    if (!requireConfig()) return;
    setBusy(true);
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth!, new GoogleAuthProvider());
      await trySyncUser();
      window.location.href = role === "mp" ? "/dashboard" : "/submit";
    } catch (e) {
      setNotice(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      {/* ---- Left: brand rail ---- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[var(--color-ink)] p-10 text-[var(--color-paper)] lg:flex">
        <Link href="/">
          <Logo />
        </Link>
        <div>
          <p className="eyebrow" style={{ color: "var(--color-marigold)" }}>
            {role === "mp" ? t.forMp.eyebrow : t.hero.badge}
          </p>
          <h2 className="display-lg mt-4 max-w-md">
            {role === "mp" ? t.forMp.title : t.auth.citizenTitle}
          </h2>
          <div className="rule-ledger mt-8 max-w-xs opacity-40" />
        </div>
        <p className="max-w-xs text-sm opacity-70">{t.footer.rights}</p>
        {/* soft glow */}
        <div
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(227,154,28,0.35), transparent 70%)" }}
        />
      </aside>

      {/* ---- Right: form ---- */}
      <main id="main" className="flex flex-col p-6 sm:p-10">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="lg:hidden">
            <Logo size={28} />
          </Link>
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-6">
          {/* role toggle */}
          <div className="mb-8 inline-flex self-start rounded-full border border-[var(--color-line)] bg-[rgba(255,253,248,0.6)] p-1 text-sm">
            {(["citizen", "mp"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(r);
                  setStep("phone");
                  setNotice(null);
                }}
                className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                  role === r ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"
                }`}
              >
                {r === "citizen" ? t.auth.switchToCitizen : t.auth.switchToMp}
              </button>
            ))}
          </div>

          <p className="eyebrow text-[var(--color-terracotta)]">{t.auth.eyebrow}</p>
          <h1 className="display-lg mt-2">
            {role === "mp" ? t.auth.mpTitle : t.auth.citizenTitle}
          </h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            {role === "mp" ? t.auth.mpSub : t.auth.citizenSub}
          </p>

          {notice && (
            <div
              role="status"
              className="mt-6 rounded-xl border border-[var(--color-marigold)] bg-[rgba(227,154,28,0.12)] px-4 py-3 text-sm"
            >
              {notice}
            </div>
          )}

          <div className="mt-7 space-y-4">
            {role === "citizen" ? (
              step === "phone" ? (
                <>
                  <div>
                    <label className="label" htmlFor="phone">
                      {t.auth.phoneLabel}
                    </label>
                    <div className="flex gap-2">
                      <span className="field flex max-w-[4.5rem] items-center justify-center font-semibold">
                        +91
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        className="field"
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <button className="btn btn-primary w-full" onClick={sendOtp} disabled={busy || phone.length < 6}>
                    {busy ? "…" : t.auth.sendOtp}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="label" htmlFor="otp">
                      {t.auth.otpLabel}
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="field text-center text-xl tracking-[0.5em]"
                      placeholder="••••••"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary w-full" onClick={verifyOtp} disabled={busy || otp.length < 4}>
                    {busy ? "…" : t.auth.verify}
                  </button>
                  <button className="text-sm underline" onClick={() => setStep("phone")}>
                    ← {t.auth.phoneLabel}
                  </button>
                </>
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-line)] p-5 text-sm text-[var(--color-ink-soft)]">
                {t.auth.mpSub}
              </div>
            )}

            <div className="flex items-center gap-4 py-1 text-xs text-[var(--color-ink-soft)]">
              <span className="h-px flex-1 bg-[var(--color-line)]" />
              {t.auth.or}
              <span className="h-px flex-1 bg-[var(--color-line)]" />
            </div>

            <button className="btn btn-ghost w-full" onClick={google} disabled={busy}>
              <GoogleGlyph /> {role === "mp" ? t.auth.mpSignIn : t.auth.google}
            </button>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-[var(--color-ink-soft)] opacity-80">{t.auth.terms}</p>
          <div id="recaptcha-container" />
        </div>
      </main>
    </div>
  );
}

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  return digits.startsWith("91") ? `+${digits}` : `+91${digits}`;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
    </svg>
  );
}
