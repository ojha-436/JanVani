"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import { useSession, maskAadhaar } from "@/lib/profile";

type Mode = "voice" | "text" | "photo";
type IdMode = "anon" | "aadhaar";

export default function SubmitPage() {
  const { t, locale } = useI18n();
  const { profile } = useSession();
  const [mode, setMode] = useState<Mode>("voice");

  // ---- identity (top of page) ----
  const [idMode, setIdMode] = useState<IdMode>("anon");
  const [aadhaar, setAadhaar] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedInfo, setVerifiedInfo] = useState<{ name: string; address: string } | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);

  // Prefill Aadhaar from the signed-in profile, if present.
  useEffect(() => {
    if (profile?.aadhaar) setAadhaar(profile.aadhaar);
  }, [profile]);

  const anonymous = !(idMode === "aadhaar" && verified);

  function verify() {
    const digits = aadhaar.replace(/\D/g, "");
    if (digits.length !== 12) {
      setIdError(t.submit.identity.invalid);
      return;
    }
    setIdError(null);
    setVerifying(true);
    // DEMO: simulate the Aadhaar verification API round-trip. Real
    // integration (UIDAI / DigiLocker) will replace this timeout and
    // return the authenticated name + address.
    window.setTimeout(() => {
      const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Aarti Sharma";
      const address = profile?.address || "12, Gandhi Marg, Ward 7, Jaipur, Rajasthan";
      setVerifiedInfo({ name, address });
      setVerified(true);
      setVerifying(false);
      setShowPopup(true);
    }, 900);
  }

  // ---- shared content fields ----
  const [text, setText] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ---- voice ----
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioBlob = useRef<Blob | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  // ---- photo ----
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoFile = useRef<File | null>(null);

  // ---- submit ----
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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

  async function submit() {
    if (!hasContent) {
      setError("Please speak, type, or add a photo describing the need.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("text", text);
      fd.append("locale", locale);
      fd.append("category", category !== null ? t.submit.categories[category] : "");
      fd.append("location", location);
      if (coords) fd.append("coords", JSON.stringify(coords));
      fd.append("anonymous", String(anonymous));
      if (!anonymous && verifiedInfo) {
        fd.append("verifiedName", verifiedInfo.name);
        fd.append("aadhaarLast4", aadhaar.replace(/\D/g, "").slice(-4));
      }
      if (audioBlob.current) fd.append("audio", audioBlob.current, "voice.webm");
      if (photoFile.current) fd.append("photo", photoFile.current);

      const res = await fetch("/api/submissions", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not send. Please try again.");
    }
  }

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

        {/* ---------- IDENTITY SELECTOR (top of page) ---------- */}
        <div className="mt-8">
          <span className="label">{t.submit.identity.heading}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <IdCard
              active={idMode === "anon"}
              onClick={() => setIdMode("anon")}
              icon={<IncognitoIcon />}
              title={t.submit.identity.anon}
              desc={t.submit.identity.anonDesc}
            />
            <IdCard
              active={idMode === "aadhaar"}
              onClick={() => setIdMode("aadhaar")}
              icon={<IdIcon />}
              title={t.submit.identity.verified}
              desc={t.submit.identity.verifiedDesc}
              badge={verified ? t.submit.identity.verifiedBadge : undefined}
            />
          </div>

          {idMode === "aadhaar" && !verified && (
            <div className="card mt-3 p-5">
              <label className="label" htmlFor="aadhaar">{t.submit.identity.aadhaarLabel}</label>
              <div className="flex gap-2">
                <input
                  id="aadhaar"
                  className="field tracking-widest"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder={t.submit.identity.aadhaarPlaceholder}
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/[^\d\s]/g, ""))}
                />
                <button className="btn btn-primary shrink-0" onClick={verify} disabled={verifying}>
                  {verifying ? t.submit.identity.verifying : t.submit.identity.verify}
                </button>
              </div>
              {idError && <p className="mt-2 text-sm text-[var(--color-terracotta)]">{idError}</p>}
            </div>
          )}

          {idMode === "aadhaar" && verified && verifiedInfo && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--color-sage)] bg-[rgba(79,111,96,0.1)] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-sage)] text-white">
                <CheckMark />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                  {t.submit.identity.verifiedAs}
                </div>
                <div className="truncate font-semibold">{verifiedInfo.name}</div>
              </div>
              <button
                className="ml-auto text-sm font-semibold underline"
                onClick={() => {
                  setVerified(false);
                  setVerifiedInfo(null);
                }}
              >
                {t.submit.identity.change}
              </button>
            </div>
          )}
        </div>

        {/* ---------- mode tabs ---------- */}
        <div className="mt-8 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--color-line)] bg-[rgba(255,253,248,0.6)] p-1.5">
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
              {audioUrl && !recording && <audio controls src={audioUrl} className="mt-4 w-full max-w-xs" />}
            </div>
          )}

          {mode === "text" && (
            <div>
              <label className="label" htmlFor="need">{t.submit.textLabel}</label>
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

          {mode === "photo" && (
            <div>
              <label className="label">{t.submit.photoLabel}</label>
              <p className="mb-3 text-sm text-[var(--color-ink-soft)]">{t.submit.photoHint}</p>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-line)] bg-[#fffdf8] p-8 text-center transition-colors hover:border-[var(--color-marigold-deep)]">
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

        {/* ---------- shared metadata ---------- */}
        <div className="mt-6 space-y-6">
          <div>
            <span className="label">{t.submit.categoryLabel}</span>
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
            <label className="label" htmlFor="loc">{t.submit.locationLabel}</label>
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
          </div>

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

      {/* ---------- Aadhaar verification popup ---------- */}
      {showPopup && verifiedInfo && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPopup(false)}
        >
          <div className="card w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-sage)] text-white">
                <CheckMark large />
              </span>
              <h3 className="font-display text-xl" style={{ fontWeight: 560 }}>
                {t.submit.identity.popupTitle}
              </h3>
            </div>
            <dl className="mt-5 space-y-3">
              <PopupRow label={t.profile.name} value={verifiedInfo.name} />
              <PopupRow label={t.onboarding.address} value={verifiedInfo.address} />
              <PopupRow label={t.onboarding.aadhaar} value={maskAadhaar(aadhaar)} />
            </dl>
            <p className="mt-4 rounded-lg bg-[rgba(227,154,28,0.12)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
              {t.submit.identity.popupNote}
            </p>
            <button className="btn btn-marigold mt-5 w-full" onClick={() => setShowPopup(false)}>
              {t.submit.identity.popupContinue}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- sub-components ---------- */
function IdCard({
  active,
  onClick,
  icon,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`relative rounded-2xl border-2 p-4 text-left transition-colors ${
        active
          ? "border-[var(--color-ink)] bg-[rgba(255,253,248,0.9)]"
          : "border-[var(--color-line)] hover:border-[var(--color-ink-soft)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-ink)]">{icon}</span>
        <span className="font-semibold">{title}</span>
        {badge && (
          <span className="ml-auto rounded-full bg-[var(--color-sage)] px-2 py-0.5 text-[0.65rem] font-bold uppercase text-white">
            {badge}
          </span>
        )}
        {active && !badge && (
          <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-ink)] text-[10px] text-[var(--color-paper)]">
            ✓
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">{desc}</p>
    </button>
  );
}

function PopupRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
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
function IncognitoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11l1.6-5.2A2 2 0 0 1 7.5 4.4h9a2 2 0 0 1 1.9 1.4L20 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 12.5h19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7.5" cy="16" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="16" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IdIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="11" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 9.5h5M13 13h5M5.5 15.2c.6-1.4 4.2-1.4 4.8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function CheckMark({ large }: { large?: boolean }) {
  const s = large ? 24 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
