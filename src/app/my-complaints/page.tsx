"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SkeletonCard } from "@/components/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { EvidenceMeter } from "@/components/ui/EvidenceMeter";
import { StatusBadge, statusLabel } from "@/components/ui/StatusBadge";
import { StatusTimeline, type TimelineEvent } from "@/components/ui/StatusTimeline";
import { useI18n, useLocalStrings } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { auth } from "@/lib/firebase";
import { getMyComplaints, type MyComplaintOut } from "@/services/api";

const PAGE_SIZE = 10;

const STRINGS = {
  en: {
    eyebrow: "Your ledger",
    title: "My complaints",
    sub: "Every issue you've raised, what the evidence looks like, and exactly where it stands — nothing hidden.",
    submitted: "Submitted",
    inProgressPending: "In progress",
    resolvedPending: "Resolved",
    department: "Assigned to",
    evidence: "Evidence strength",
    whyTitle: "Why this rating?",
    whyIntro: "Computed by fixed rules on real signals — never by an AI's opinion:",
    noReasons: "The rating is being computed from corroborating reports and attached media.",
    loadMore: "Load more",
    loading: "Loading…",
    emptyTitle: "No complaints yet",
    emptyBody: "When you raise an issue, you'll see its full journey here — from submission to resolution.",
    emptyCta: "Raise your first complaint",
    error: "Couldn't load your complaints. Please try again.",
    retry: "Retry",
    anonymous: "Anonymous",
  },
  hi: {
    eyebrow: "आपका बहीखाता",
    title: "मेरी शिकायतें",
    sub: "आपकी उठाई हर समस्या, उसके प्रमाण की मजबूती, और वह ठीक किस स्थिति में है — कुछ भी छिपा नहीं।",
    submitted: "दर्ज हुई",
    inProgressPending: "प्रगति में",
    resolvedPending: "हल",
    department: "विभाग",
    evidence: "प्रमाण की मजबूती",
    whyTitle: "यह रेटिंग क्यों?",
    whyIntro: "वास्तविक संकेतों पर तय नियमों से गणना — कभी भी AI की राय से नहीं:",
    noReasons: "रेटिंग आस-पास की पुष्टि करने वाली शिकायतों और जुड़ी मीडिया से बन रही है।",
    loadMore: "और देखें",
    loading: "लोड हो रहा है…",
    emptyTitle: "अभी कोई शिकायत नहीं",
    emptyBody: "जब आप कोई समस्या दर्ज करेंगे, उसकी पूरी यात्रा यहाँ दिखेगी — दर्ज होने से हल होने तक।",
    emptyCta: "पहली शिकायत दर्ज करें",
    error: "आपकी शिकायतें लोड नहीं हो पाईं। कृपया फिर से कोशिश करें।",
    retry: "फिर कोशिश करें",
    anonymous: "गुमनाम",
  },
};

function buildTimeline(c: MyComplaintOut, s: typeof STRINGS.en, locale: string): TimelineEvent[] {
  const events: TimelineEvent[] = [{ label: s.submitted, at: c.created_at, state: "done" }];
  for (const h of c.status_history) {
    events.push({ label: statusLabel(h.new_status, locale), at: h.changed_at, state: "done" });
  }
  // Future steps are drawn hollow — only recorded transitions are "done".
  if (c.status === "new") {
    events.push({ label: s.inProgressPending, state: "pending" });
    events.push({ label: s.resolvedPending, state: "pending" });
  } else if (c.status === "in_progress") {
    events.push({ label: s.resolvedPending, state: "pending" });
  }
  const lastDone = events.filter((e) => e.state === "done").length - 1;
  if (c.status !== "resolved" && lastDone >= 0) events[lastDone] = { ...events[lastDone], state: "current" };
  return events;
}

export default function MyComplaintsPage() {
  const { locale } = useI18n();
  const s = useLocalStrings(STRINGS);
  const { ready, firebaseUser, isOnboarded } = useSession();
  const [complaints, setComplaints] = useState<MyComplaintOut[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!firebaseUser) window.location.href = "/sign-in";
    else if (!isOnboarded) window.location.href = "/onboarding";
  }, [ready, firebaseUser, isOnboarded]);

  const load = useCallback(async (offset: number) => {
    try {
      setLoading(true);
      setError(null);
      const idToken = await auth!.currentUser!.getIdToken();
      const page = await getMyComplaints(idToken, { limit: PAGE_SIZE + 1, offset });
      setHasMore(page.length > PAGE_SIZE);
      const items = page.slice(0, PAGE_SIZE);
      setComplaints((prev) => (offset === 0 ? items : [...prev, ...items]));
    } catch (e) {
      console.error("Failed to load my complaints", e);
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !firebaseUser || !isOnboarded) return;
    load(0);
  }, [ready, firebaseUser, isOnboarded, load]);

  if (!ready || !firebaseUser) {
    return (
      <>
        <Header />
        <main id="main" className="mx-auto max-w-3xl px-5 py-12">
          <SkeletonCard lines={4} />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow text-[var(--color-marigold-deep)]">{s.eyebrow}</p>
        <h1 className="display-lg mt-2 text-[var(--color-ink)]">{s.title}</h1>
        <p className="mt-3 max-w-xl text-[var(--color-ink-soft)]">{s.sub}</p>

        <div className="mt-10 space-y-6">
          {error && (
            <div className="card border-[var(--color-terracotta)] p-5 text-sm">
              <p className="text-[var(--color-terracotta)]">{s.error}</p>
              <button type="button" className="btn btn-ghost mt-3 !py-2 text-sm" onClick={() => load(complaints.length)}>
                {s.retry}
              </button>
            </div>
          )}

          {loading && complaints.length === 0 && (
            <>
              <SkeletonCard lines={5} />
              <SkeletonCard lines={5} />
            </>
          )}

          {!loading && !error && complaints.length === 0 && (
            <EmptyState title={s.emptyTitle} body={s.emptyBody} ctaHref="/submit" ctaLabel={s.emptyCta} />
          )}

          {complaints.map((c) => (
            <article key={c.id} className="card rise p-6">
              <div className="flex flex-wrap items-center gap-2">
                {c.category && <span className="chip">{c.category}</span>}
                <StatusBadge status={c.status} locale={locale} />
                {c.anonymous && (
                  <span className="text-xs font-semibold text-[var(--color-ink-soft)] opacity-80">{s.anonymous}</span>
                )}
                <span className="ml-auto text-xs text-[var(--color-ink-soft)]">
                  {new Date(c.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              <p className="mt-3 leading-relaxed text-[var(--color-ink)]">{c.text}</p>

              {c.location && <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">📍 {c.location}</p>}
              {c.assigned_department && (
                <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
                  {s.department}: <span className="font-bold text-[var(--color-ink)]">{c.assigned_department}</span>
                </p>
              )}

              {c.audio_url && <audio className="mt-3 h-9 w-full max-w-sm" controls preload="none" src={c.audio_url} />}
              {c.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt="" className="mt-3 max-h-56 rounded-[var(--radius)] border border-[var(--color-line)] object-cover" />
              )}

              <div className="mt-5 grid gap-6 border-t border-[var(--color-line)] pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-soft)]">{s.evidence}</p>
                  <EvidenceMeter score={c.verification_confidence} level={c.verification_status} className="mt-2" />
                  <p className="mt-3 text-xs font-bold text-[var(--color-ink-soft)]">{s.whyTitle}</p>
                  {c.verification_reasons && c.verification_reasons.length > 0 ? (
                    <>
                      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{s.whyIntro}</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[var(--color-ink-soft)]">
                        {c.verification_reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{s.noReasons}</p>
                  )}
                </div>
                <StatusTimeline events={buildTimeline(c, s, locale)} />
              </div>
            </article>
          ))}

          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading}
                onClick={() => load(complaints.length)}
              >
                {loading ? s.loading : s.loadMore}
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
