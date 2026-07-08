"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SkeletonCard } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { auth } from "@/lib/firebase";
import { INDIAN_STATES } from "@/lib/constants";
import { getMyNotifications, getMyStats, type MyStatsOut, type NotificationOut, type ProfileUpdateInput } from "@/services/api";

const NOTIFICATION_STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const EMPTY_FORM: ProfileUpdateInput = {
  first_name: "",
  last_name: "",
  address: "",
  constituency: "",
  pincode: "",
  state: "",
  aadhaar: "",
};

export default function ProfilePage() {
  const { t } = useI18n();
  const { ready, firebaseUser, profile, isOnboarded, saveProfile, signOut } = useSession();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileUpdateInput>(EMPTY_FORM);
  const [welcome, setWelcome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [stats, setStats] = useState<MyStatsOut | null>(null);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get("welcome") === "1");
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!firebaseUser) window.location.href = "/sign-in";
    else if (!isOnboarded) window.location.href = "/onboarding";
  }, [ready, firebaseUser, isOnboarded]);

  useEffect(() => {
    if (!ready || !firebaseUser || !isOnboarded) return;
    auth!.currentUser!
      .getIdToken()
      .then((idToken) => getMyNotifications(idToken))
      .then(setNotifications)
      .catch((e) => console.error("Failed to load notifications", e));
    auth!.currentUser!
      .getIdToken()
      .then((idToken) => getMyStats(idToken))
      .then(setStats)
      .catch((e) => console.error("Failed to load civic stats", e));
  }, [ready, firebaseUser, isOnboarded]);

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

  if (!ready || (ready && firebaseUser && !profile)) {
    return (
      <>
        <Header />
        <main id="main" className="mx-auto max-w-2xl px-5 py-12">
          <SkeletonCard lines={4} />
        </main>
        <Footer />
      </>
    );
  }
  if (!firebaseUser || !profile) return null;

  function set<K extends keyof ProfileUpdateInput>(key: K, value: ProfileUpdateInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    try {
      await saveProfile({
        ...form,
        aadhaar: form.aadhaar ? form.aadhaar.replace(/\D/g, "") : null,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  const maskedAadhaar = profile.aadhaar_last4 ? `XXXX XXXX ${profile.aadhaar_last4}` : "";

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-2xl px-5 py-12">
        {welcome && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-sage)] bg-[rgba(79,111,96,0.12)] px-4 py-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage)] text-xs font-bold text-white">
              ✓
            </span>
            {t.profile.welcome}
          </div>
        )}

        {notifications.length > 0 && (
          <div className="mb-6 space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[rgba(216,154,43,0.1)] px-4 py-3 text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-marigold)] text-xs font-bold text-white">
                  !
                </span>
                Your complaint{n.category ? ` about ${n.category}` : ""} is now{" "}
                <strong>{NOTIFICATION_STATUS_LABEL[n.new_status] || n.new_status}</strong>.
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[var(--color-terracotta)]">{t.profile.eyebrow}</p>
            <h1 className="display-lg mt-2">{t.profile.title}</h1>
            <p className="mt-2 text-[var(--color-ink-soft)]">{t.profile.sub}</p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-2xl font-bold text-[var(--color-marigold)]">
            {(profile.first_name?.[0] ?? "?").toUpperCase()}
          </div>
        </div>

        {stats && <CivicCard stats={stats} />}

        <div className="card mt-8 p-6 sm:p-8">
          {!editing ? (
            <>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Field label={t.profile.name} value={fullName || t.profile.notSet} />
                <Field label={t.onboarding.constituency} value={profile.constituency || t.profile.notSet} />
                <Field label={t.onboarding.address} value={profile.address || t.profile.notSet} full />
                <Field label={t.onboarding.state} value={profile.state || t.profile.notSet} />
                <Field label={t.onboarding.pincode} value={profile.pincode || t.profile.notSet} />
                <Field label={t.onboarding.aadhaar} value={maskedAadhaar || t.profile.notSet} full />
              </dl>

              <div className="rule-ledger my-7" />

              <p className="eyebrow mb-3 text-[var(--color-ink-soft)]">{t.profile.contactHeading}</p>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {profile.phone_number && <Field label={t.profile.phone} value={profile.phone_number} />}
                {profile.email && <Field label={t.profile.email} value={profile.email} />}
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={() => setEditing(true)}>
                  {t.profile.edit}
                </button>
                <Link href="/submit" className="btn btn-marigold">
                  {t.profile.raiseVoice}
                </Link>
                <button
                  className="btn btn-ghost ml-auto"
                  onClick={async () => {
                    await signOut();
                    window.location.href = "/";
                  }}
                >
                  {t.profile.signOut}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="fn">
                    {t.onboarding.firstName}
                  </label>
                  <input id="fn" className="field" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="ln">
                    {t.onboarding.lastName}
                  </label>
                  <input id="ln" className="field" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="addr">
                    {t.onboarding.address}
                  </label>
                  <textarea
                    id="addr"
                    rows={2}
                    className="field resize-none"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="con">
                    {t.onboarding.constituency}
                  </label>
                  <input
                    id="con"
                    className="field"
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
                    value={form.pincode}
                    onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
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
                    {t.onboarding.aadhaar}
                  </label>
                  <input
                    id="aad"
                    className="field tracking-widest"
                    inputMode="numeric"
                    maxLength={14}
                    placeholder={maskedAadhaar || "1234 5678 9012"}
                    value={form.aadhaar ?? ""}
                    onChange={(e) => set("aadhaar", e.target.value.replace(/[^\d\s]/g, ""))}
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="btn btn-primary" onClick={save} disabled={busy}>
                  {busy ? "…" : t.profile.save}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setForm({
                      first_name: profile.first_name ?? "",
                      last_name: profile.last_name ?? "",
                      address: profile.address ?? "",
                      constituency: profile.constituency ?? "",
                      pincode: profile.pincode ?? "",
                      state: profile.state ?? "",
                      aadhaar: "",
                    });
                    setEditing(false);
                  }}
                >
                  {t.profile.cancel}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

/* Civic standing — numbers come straight from GET /users/me/stats, which
   applies the fixed rules in backend/app/civic.py. Nothing is computed
   here beyond the progress-bar width. */
function CivicCard({ stats }: { stats: MyStatsOut }) {
  const target = stats.points_to_next != null ? stats.civic_points + stats.points_to_next : stats.civic_points;
  const pct = target > 0 ? Math.min(100, Math.round((stats.civic_points / target) * 100)) : 100;
  return (
    <div className="card mt-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-[var(--color-marigold-deep)]">Civic standing</p>
          <p className="font-display mt-1 text-2xl font-semibold text-[var(--color-ink)]">
            {stats.badge}
            <span className="ml-2 text-base font-medium text-[var(--color-ink-soft)]">{stats.civic_points} pts</span>
          </p>
        </div>
        <div className="flex gap-5 text-center text-sm">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--color-ink)]">{stats.complaints_total}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">raised</p>
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-[var(--color-sage)]">{stats.resolved_count}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">resolved</p>
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-[var(--color-marigold-deep)]">{stats.in_progress_count}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">in progress</p>
          </div>
        </div>
      </div>
      {stats.next_badge && stats.points_to_next != null && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)]">
            <div className="h-full rounded-full bg-[var(--color-marigold)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">
            {stats.points_to_next} pts to <strong>{stats.next_badge}</strong>
          </p>
        </div>
      )}
      <Link href="/my-complaints" className="mt-4 inline-block text-sm font-bold text-[var(--color-indigo)] hover:underline">
        View my complaints →
      </Link>
    </div>
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
