"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { INDIAN_STATES } from "@/lib/constants";
import type { ProfileUpdateInput } from "@/services/api";

const EMPTY_FORM: ProfileUpdateInput = {
  first_name: "",
  last_name: "",
  address: "",
  constituency: "",
  pincode: "",
  state: "",
  aadhaar: "",
};

export default function OnboardingPage() {
  const { t } = useI18n();
  const { ready, firebaseUser, profile, isOnboarded, saveProfile } = useSession();
  const [form, setForm] = useState<ProfileUpdateInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill from any partial profile once it's loaded.
  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        address: profile.address ?? "",
        constituency: profile.constituency ?? "",
        pincode: profile.pincode ?? "",
        state: profile.state ?? "",
        aadhaar: "",
      });
    }
  }, [profile]);

  // Gatekeeping: need to be signed in; skip if already onboarded.
  useEffect(() => {
    if (!ready) return;
    if (!firebaseUser) window.location.href = "/sign-in";
    else if (isOnboarded) window.location.href = "/profile";
  }, [ready, firebaseUser, isOnboarded]);

  function set<K extends keyof ProfileUpdateInput>(key: K, value: ProfileUpdateInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.first_name.trim() || !form.state.trim()) {
      setError(t.onboarding.required);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveProfile({
        ...form,
        first_name: form.first_name.trim(),
        last_name: (form.last_name ?? "").trim(),
        aadhaar: form.aadhaar ? form.aadhaar.replace(/\D/g, "") : null,
      });
      window.location.href = "/profile?welcome=1";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !firebaseUser) return null;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-line)] bg-[rgba(246,241,231,0.82)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Link href="/" aria-label="JanVaani home">
            <Logo />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-2xl px-5 py-12">
        <div className="mb-6 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-sage)] text-xs font-bold text-white">
            ✓
          </span>
          <span className="h-px w-8 bg-[var(--color-line)]" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-ink)] text-xs font-bold text-[var(--color-paper)]">
            2
          </span>
          <span className="ml-1">Step 2 of 2</span>
        </div>

        <p className="eyebrow text-[var(--color-terracotta)]">{t.onboarding.eyebrow}</p>
        <h1 className="display-lg mt-3">{t.onboarding.title}</h1>
        <p className="mt-3 text-lg text-[var(--color-ink-soft)]">{t.onboarding.sub}</p>

        <div className="card mt-8 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fn">
                {t.onboarding.firstName}
              </label>
              <input
                id="fn"
                className="field"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="label" htmlFor="ln">
                {t.onboarding.lastName}
              </label>
              <input
                id="ln"
                className="field"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="addr">
                {t.onboarding.address}
              </label>
              <textarea
                id="addr"
                rows={2}
                className="field resize-none"
                placeholder={t.onboarding.addressPlaceholder}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                autoComplete="street-address"
              />
            </div>
            <div>
              <label className="label" htmlFor="con">
                {t.onboarding.constituency}
              </label>
              <input
                id="con"
                className="field"
                placeholder={t.onboarding.constituencyPlaceholder}
                value={form.constituency}
                onChange={(e) => set("constituency", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="pin">
                {t.onboarding.pincode}
              </label>
              <input
                id="pin"
                className="field"
                inputMode="numeric"
                maxLength={6}
                placeholder={t.onboarding.pincodePlaceholder}
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
                autoComplete="postal-code"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="st">
                {t.onboarding.state}
              </label>
              <select id="st" className="field" value={form.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">{t.onboarding.statePlaceholder}</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="aad">
                {t.onboarding.aadhaar}{" "}
                <span className="font-normal text-[var(--color-ink-soft)] opacity-70">
                  ({t.onboarding.aadhaarTag})
                </span>
              </label>
              <input
                id="aad"
                className="field tracking-widest"
                inputMode="numeric"
                maxLength={14}
                placeholder="1234 5678 9012"
                value={form.aadhaar ?? ""}
                onChange={(e) => set("aadhaar", e.target.value.replace(/[^\d\s]/g, ""))}
              />
              <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">{t.onboarding.aadhaarHint}</p>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-[rgba(182,74,52,0.12)] px-4 py-3 text-sm text-[var(--color-terracotta)]">
              {error}
            </p>
          )}

          <button className="btn btn-marigold mt-6 w-full text-base" onClick={save} disabled={busy}>
            {busy ? "…" : t.onboarding.save}
          </button>
        </div>
      </main>
    </div>
  );
}
