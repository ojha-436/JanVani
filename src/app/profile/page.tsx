"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import { useSession, maskAadhaar, EMPTY_PROFILE, type Profile } from "@/lib/profile";
import { INDIAN_STATES } from "@/lib/constants";

export default function ProfilePage() {
  const { t } = useI18n();
  const { ready, session, profile, isOnboarded, saveProfile, signOut } = useSession();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile>(EMPTY_PROFILE);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get("welcome") === "1");
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) window.location.href = "/sign-in";
    else if (!isOnboarded) window.location.href = "/onboarding";
  }, [ready, session, isOnboarded]);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  if (!ready || !session || !profile) return null;

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    saveProfile({ ...form, aadhaar: (form.aadhaar ?? "").replace(/\D/g, "") });
    setEditing(false);
  }

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-2xl px-5 py-12">
        {welcome && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-sage)] bg-[rgba(79,111,96,0.12)] px-4 py-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage)] text-xs font-bold text-white">✓</span>
            {t.profile.welcome}
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[var(--color-terracotta)]">{t.profile.eyebrow}</p>
            <h1 className="display-lg mt-2">{t.profile.title}</h1>
            <p className="mt-2 text-[var(--color-ink-soft)]">{t.profile.sub}</p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-2xl font-bold text-[var(--color-marigold)]">
            {(profile.firstName[0] ?? "?").toUpperCase()}
          </div>
        </div>

        <div className="card mt-8 p-6 sm:p-8">
          {!editing ? (
            <>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Field label={t.profile.name} value={fullName || t.profile.notSet} />
                <Field label={t.onboarding.constituency} value={profile.constituency || t.profile.notSet} />
                <Field label={t.onboarding.address} value={profile.address || t.profile.notSet} full />
                <Field label={t.onboarding.state} value={profile.state || t.profile.notSet} />
                <Field label={t.onboarding.pincode} value={profile.pincode || t.profile.notSet} />
                <Field label={t.onboarding.aadhaar} value={maskAadhaar(profile.aadhaar) || t.profile.notSet} full />
              </dl>

              <div className="rule-ledger my-7" />

              <p className="eyebrow mb-3 text-[var(--color-ink-soft)]">{t.profile.contactHeading}</p>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {session.phone && <Field label={t.profile.phone} value={session.phone} />}
                {session.email && <Field label={t.profile.email} value={session.email} />}
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={() => setEditing(true)}>
                  {t.profile.edit}
                </button>
                <Link href="/submit" className="btn btn-marigold">
                  {t.profile.raiseVoice}
                </Link>
                <button className="btn btn-ghost ml-auto" onClick={() => { signOut(); window.location.href = "/"; }}>
                  {t.profile.signOut}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="fn">{t.onboarding.firstName}</label>
                  <input id="fn" className="field" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="ln">{t.onboarding.lastName}</label>
                  <input id="ln" className="field" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="addr">{t.onboarding.address}</label>
                  <textarea id="addr" rows={2} className="field resize-none" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="con">{t.onboarding.constituency}</label>
                  <input id="con" className="field" value={form.constituency} onChange={(e) => set("constituency", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="pin">{t.onboarding.pincode}</label>
                  <input id="pin" className="field" inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="st">{t.onboarding.state}</label>
                  <select id="st" className="field" value={form.state} onChange={(e) => set("state", e.target.value)}>
                    <option value="">{t.onboarding.statePlaceholder}</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="aad">{t.onboarding.aadhaar}</label>
                  <input id="aad" className="field tracking-widest" inputMode="numeric" maxLength={14} value={form.aadhaar} onChange={(e) => set("aadhaar", e.target.value.replace(/[^\d\s]/g, ""))} />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="btn btn-primary" onClick={save}>{t.profile.save}</button>
                <button className="btn btn-ghost" onClick={() => { setForm(profile!); setEditing(false); }}>{t.profile.cancel}</button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-sm font-semibold text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="mt-0.5 text-[1.05rem]">{value}</dd>
    </div>
  );
}
