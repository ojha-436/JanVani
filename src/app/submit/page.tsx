"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MiniMap } from "@/components/MiniMap";
import { useI18n, useLocalStrings } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { storage, auth } from "@/lib/firebase";
import {
  getNearbyComplaints,
  submitComplaint,
  suggestCategory,
  type CategorySuggestion,
  type NearbyComplaintOut,
} from "@/services/api";

type Mode = "voice" | "text" | "photo";

const LOCAL = {
  en: {
    suggested: "Suggested for you (tap to accept):",
    nearbyTitle: "Already reported near you",
    nearbyBody: "Your report still counts — repeated reports strengthen the evidence.",
    nearbyNone: "Nothing reported within 3 km yet — yours will be the first.",
    draftRestored: "We restored your unfinished draft.",
    draftDiscard: "Discard",
  },
  hi: {
    suggested: "आपके लिए सुझाव (चुनने के लिए टैप करें):",
    nearbyTitle: "आपके पास पहले से दर्ज",
    nearbyBody: "आपकी रिपोर्ट फिर भी मायने रखती है — बार-बार की रिपोर्टें प्रमाण मज़बूत करती हैं।",
    nearbyNone: "3 कि.मी. के भीतर अभी कुछ दर्ज नहीं — आपकी रिपोर्ट पहली होगी।",
    draftRestored: "आपका अधूरा ड्राफ्ट वापस लाया गया।",
    draftDiscard: "हटाएँ",
  },
};

// Backend classifier speaks the canonical category names; the submit UI's
// chips are localized labels in a slightly different taxonomy — this maps
// a suggestion onto the chip the citizen actually sees.
const CANONICAL_TO_CHIP_INDEX: Record<string, number> = {
  Roads: 0,
  "Water Supply": 1,
  Sanitation: 1,
  Education: 2,
  Healthcare: 3,
  Electricity: 4,
  "Public Safety": 6,
};

const DRAFT_KEY = "janvaani.draft.submit";

type Draft = {
  mode: Mode;
  text: string;
  category: number | null;
  location: string;
  anon: boolean;
};

export default function SubmitPage() {
  const { t, locale } = useI18n();
  const { ready, firebaseUser } = useSession();
  const [mode, setMode] = useState<Mode>("voice");

  // shared fields
  const [text, setText] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [anon, setAnon] = useState(false);

  // voice
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioBlob = useRef<Blob | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  // photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoFile = useRef<File | null>(null);

  // submit state
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const local = useLocalStrings(LOCAL);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [nearby, setNearby] = useState<NearbyComplaintOut[] | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // "Anonymous" only hides the citizen's identity from the MP — sign-in is
  // still required so we can attribute (privately) and prevent spam.
  useEffect(() => {
    if (ready && !firebaseUser) window.location.href = "/sign-in";
  }, [ready, firebaseUser]);

  // Restore an unfinished draft once, before any typing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      if (!draft.text && !draft.location && draft.category == null) return;
      setMode(draft.mode ?? "text");
      setText(draft.text ?? "");
      setCategory(draft.category ?? null);
      setLocation(draft.location ?? "");
      setAnon(Boolean(draft.anon));
      setDraftRestored(true);
    } catch {
      // A corrupt draft should never block the form.
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Auto-save the typed parts of the draft (media blobs can't go to
  // localStorage; text/category/location cover the real re-typing pain).
  useEffect(() => {
    const handle = setTimeout(() => {
      if (status !== "idle" && status !== "error") return;
      if (!text && !location && category == null) return;
      const draft: Draft = { mode, text, category, location, anon };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* storage full/blocked — silently skip */
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [mode, text, category, location, anon, status]);

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setText("");
    setCategory(null);
    setLocation("");
    setAnon(false);
    setDraftRestored(false);
  }

  // Deterministic category suggestions while typing (fixed keyword rules
  // server-side — the citizen always confirms by tapping a chip).
  useEffect(() => {
    if (text.trim().length < 12 || !auth?.currentUser) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const idToken = await auth!.currentUser!.getIdToken();
        const res = await suggestCategory(idToken, text);
        setSuggestions(res.suggestions.filter((sg) => sg.category in CANONICAL_TO_CHIP_INDEX));
      } catch {
        setSuggestions([]);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [text]);

  // Once we know where the citizen is, show what's already reported there.
  useEffect(() => {
    if (!coords || !auth?.currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await auth!.currentUser!.getIdToken();
        const points = await getNearbyComplaints(idToken, coords.lat, coords.lng, { radiusKm: 3 });
        if (!cancelled) setNearby(points);
      } catch {
        if (!cancelled) setNearby(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        audioBlob.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mr.start();
      recorder.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone permission is needed to record. You can also type or add a photo.");
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    setRecording(false);
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    photoFile.current = file;
    setPhotoUrl(URL.createObjectURL(file));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocation(`📍 ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      () => setError("Couldn't get your location — please type your area instead.")
    );
  }

  const hasContent = Boolean(text.trim()) || Boolean(audioUrl) || Boolean(photoUrl);

  async function uploadToStorage(blob: Blob, extension: string): Promise<string> {
    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const fileRef = ref(storage!, `complaints/${crypto.randomUUID()}.${extension}`);
    await uploadBytes(fileRef, blob);
    return getDownloadURL(fileRef);
  }

  async function submit() {
    if (!hasContent) {
      setError("Please speak, type, or add a photo describing the need.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const [uploadedAudioUrl, uploadedPhotoUrl] = await Promise.all([
        audioBlob.current ? uploadToStorage(audioBlob.current, "webm") : Promise.resolve(undefined),
        photoFile.current ? uploadToStorage(photoFile.current, photoFile.current.name.split(".").pop() || "jpg") : Promise.resolve(undefined),
      ]);

      const idToken = await auth!.currentUser!.getIdToken();
      await submitComplaint(
        {
          text,
          locale,
          category: category !== null ? t.submit.categories[category] : undefined,
          location,
          coords,
          anonymous: anon,
          audioUrl: uploadedAudioUrl,
          photoUrl: uploadedPhotoUrl,
        },
        idToken
      );
      localStorage.removeItem(DRAFT_KEY);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not send. Please try again.");
    }
  }

  if (!ready || !firebaseUser) return null;
  if (status === "done") return <SuccessScreen />;

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "voice", label: t.submit.voiceTab, icon: <MicIcon /> },
    { id: "text", label: t.submit.textTab, icon: <PenIcon /> },
    { id: "photo", label: t.submit.photoTab, icon: <CamIcon /> },
  ];

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-2xl px-5 py-12">
        <p className="eyebrow text-[var(--color-terracotta)]">{t.submit.eyebrow}</p>
        <h1 className="display-lg mt-3">{t.submit.title}</h1>
        <p className="mt-3 text-lg text-[var(--color-ink-soft)]">{t.submit.sub}</p>

        {draftRestored && (
          <div className="card mt-6 flex items-center justify-between gap-3 border-[var(--color-marigold-deep)] px-4 py-3 text-sm">
            <span className="font-semibold text-[var(--color-ink)]">{local.draftRestored}</span>
            <button type="button" className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs" onClick={discardDraft}>
              {local.draftDiscard}
            </button>
          </div>
        )}

        {/* mode tabs */}
        <div className="mt-8 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              aria-pressed={mode === tab.id}
              className={`flex flex-col items-center gap-1.5 rounded-xl py-3.5 font-semibold transition-colors ${
                mode === tab.id
                  ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                  : "text-[var(--color-ink-soft)] hover:bg-[rgba(22,34,29,0.05)]"
              }`}
            >
              {tab.icon}
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="card mt-5 p-6 sm:p-8">
          {/* ---- VOICE ---- */}
          {mode === "voice" && (
            <div className="flex flex-col items-center py-4 text-center">
              <p className="mb-6 text-[var(--color-ink-soft)]">{t.submit.voiceHint}</p>
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`flex h-28 w-28 items-center justify-center rounded-full text-[var(--color-paper)] transition-transform active:scale-95 ${
                  recording ? "recording bg-[var(--color-terracotta)]" : "bg-[var(--color-ink)]"
                }`}
                aria-label={recording ? t.submit.recordStop : t.submit.recordStart}
              >
                {recording ? <StopIcon /> : <MicIcon large />}
              </button>
              <p className="mt-5 font-semibold">
                {recording ? t.submit.recording : audioUrl ? t.submit.recorded : t.submit.recordStart}
              </p>
              {audioUrl && !recording && (
                <audio controls src={audioUrl} className="mt-4 w-full max-w-xs" />
              )}
            </div>
          )}

          {/* ---- TEXT ---- */}
          {mode === "text" && (
            <div>
              <label className="label" htmlFor="need">
                {t.submit.textLabel}
              </label>
              <textarea
                id="need"
                rows={5}
                className="field resize-none"
                placeholder={t.submit.textPlaceholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          )}

          {/* ---- PHOTO ---- */}
          {mode === "photo" && (
            <div>
              <label className="label">{t.submit.photoLabel}</label>
              <p className="mb-3 text-sm text-[var(--color-ink-soft)]">{t.submit.photoHint}</p>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-line)] bg-[var(--color-field)] p-8 text-center transition-colors hover:border-[var(--color-marigold-deep)]">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Preview" className="max-h-56 rounded-xl object-contain" />
                ) : (
                  <>
                    <CamIcon large />
                    <span className="mt-3 font-semibold">{t.submit.photoTab}</span>
                  </>
                )}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
              </label>
            </div>
          )}
        </div>

        {/* ---- shared metadata ---- */}
        <div className="mt-6 space-y-6">
          <div>
            <span className="label">{t.submit.categoryLabel}</span>
            {suggestions.length > 0 && (
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--color-marigold-deep)]">{local.suggested}</span>
                {suggestions.map((sg) => {
                  const idx = CANONICAL_TO_CHIP_INDEX[sg.category];
                  return (
                    <button
                      key={sg.category}
                      type="button"
                      onClick={() => setCategory(idx)}
                      className={`chip text-xs ${category === idx ? "chip-active" : ""}`}
                      title={`Matched: ${sg.matched_keywords.join(", ")}`}
                    >
                      ✦ {t.submit.categories[idx]}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {t.submit.categories.map((c, i) => (
                <button
                  key={c}
                  onClick={() => setCategory(i)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    category === i
                      ? "border-[var(--color-marigold-deep)] bg-[var(--color-marigold)] text-[#201401]"
                      : "border-[var(--color-line)] hover:border-[var(--color-ink-soft)]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="loc">
              {t.submit.locationLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="loc"
                className="field"
                placeholder={t.submit.locationPlaceholder}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button className="btn btn-ghost shrink-0 !px-4" onClick={useMyLocation} type="button">
                <PinIcon /> <span className="hidden sm:inline">{t.submit.useLocation}</span>
              </button>
            </div>
            {coords && nearby !== null && (
              <div className="card mt-3 p-4">
                <p className="text-sm font-bold text-[var(--color-ink)]">
                  {local.nearbyTitle}
                  {nearby.length > 0 ? ` · ${nearby.length}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                  {nearby.length > 0 ? local.nearbyBody : local.nearbyNone}
                </p>
                {nearby.length > 0 && <MiniMap center={coords} points={nearby} className="mt-3" />}
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <input
              type="checkbox"
              checked={anon}
              onChange={(e) => setAnon(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-ink)]"
            />
            <span className="font-medium">{t.submit.anonToggle}</span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-[rgba(182,74,52,0.12)] px-4 py-3 text-sm text-[var(--color-terracotta)]">
              {error}
            </p>
          )}

          <button className="btn btn-marigold w-full text-base" onClick={submit} disabled={status === "sending"}>
            {status === "sending" ? "…" : t.submit.submitBtn}
          </button>
          <p className="text-center text-xs text-[var(--color-ink-soft)] opacity-80">{t.submit.privacy}</p>
        </div>
      </main>
      <Footer />
    </>
  );
}

function SuccessScreen() {
  const { t } = useI18n();
  return (
    <>
      <Header />
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-sage)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="display-lg mt-7">{t.submit.title}</h1>
        <p className="mt-3 text-lg text-[var(--color-ink-soft)]">
          Your voice has been received and will be counted alongside others raising the same need.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/submit" className="btn btn-ghost" onClick={() => location.reload()}>
            Raise another
          </Link>
          <Link href="/" className="btn btn-primary">
            Back home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ---------- icons ---------- */
function MicIcon({ large }: { large?: boolean }) {
  const s = large ? 44 : 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function CamIcon({ large }: { large?: boolean }) {
  const s = large ? 40 : 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12.5" r="3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
