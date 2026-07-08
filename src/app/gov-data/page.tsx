"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SkeletonCard } from "@/components/Skeleton";
import { useSession } from "@/lib/session";
import { auth } from "@/lib/firebase";
import {
  uploadGovData,
  importGovDataFromApi,
  listGovDataImports,
  type GovDataImportOut,
} from "@/services/api";

const STATUS_COLOR: Record<string, string> = {
  committed: "var(--color-sage)",
  needs_review: "var(--color-marigold)",
  failed: "var(--color-terracotta)",
};

export default function GovDataPage() {
  const { ready, firebaseUser, isMp } = useSession();
  const [imports, setImports] = useState<GovDataImportOut[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);
  const [importsError, setImportsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!firebaseUser) {
      window.location.href = "/sign-in?role=mp";
      return;
    }
    if (!isMp) {
      window.location.href = "/";
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, firebaseUser, isMp]);

  async function refresh() {
    setLoadingImports(true);
    setImportsError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      setImports(await listGovDataImports(idToken));
    } catch (e) {
      setImportsError(e instanceof Error ? e.message : "Failed to load import history");
    } finally {
      setLoadingImports(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      await uploadGovData(idToken, file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleApiImport() {
    if (!resourceId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const idToken = await auth!.currentUser!.getIdToken();
      await importGovDataFromApi(idToken, resourceId.trim());
      setResourceId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !firebaseUser || !isMp) return null;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[rgba(246,241,231,0.82)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/dashboard" aria-label="JanVaani dashboard">
            <Logo size={30} />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-5 py-12">
        <p className="eyebrow text-[var(--color-terracotta)]">MP tools</p>
        <h1 className="display-lg mt-2">Update government data</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Upload an Excel, CSV, or PDF file, or pull directly from a data.gov.in API resource. AI only maps
          columns and flags data-quality issues — it never decides what gets stored; a fixed confidence
          threshold does.
        </p>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-[rgba(182,74,52,0.12)] px-4 py-3 text-sm text-[var(--color-terracotta)]">
            {error}
          </p>
        )}

        <section className="card mt-8 p-6 sm:p-8">
          <p className="text-lg font-bold">Upload a file</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">.xlsx, .csv, or .pdf — category is detected automatically.</p>
          <label className="btn btn-marigold mt-4 inline-flex cursor-pointer !py-2.5 !px-4 text-sm">
            {busy ? "Processing…" : "Choose file"}
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleUpload} disabled={busy} />
          </label>
        </section>

        <section className="card mt-6 p-6 sm:p-8">
          <p className="text-lg font-bold">Fetch from data.gov.in</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Enter a data.gov.in resource ID to pull and process it directly.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              placeholder="e.g. 97adce0c-89a8-4f1e-a0f8-b66655136565"
              className="flex-1 rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2.5 text-sm"
            />
            <button onClick={handleApiImport} disabled={busy || !resourceId.trim()} className="btn btn-marigold !py-2.5 !px-4 text-sm">
              Import
            </button>
          </div>
        </section>

        <section className="mt-10">
          <p className="eyebrow text-[var(--color-ink-soft)]">Import history</p>
          {loadingImports ? (
            <div className="mt-4">
              <SkeletonCard lines={2} />
            </div>
          ) : importsError ? (
            <div className="card mt-4 flex flex-wrap items-center gap-3 p-6 text-sm text-[var(--color-terracotta)]">
              <span>{importsError}</span>
              <button
                type="button"
                className="rounded-full border border-[var(--color-terracotta)] px-3 py-1 text-xs font-semibold"
                onClick={refresh}
              >
                Retry
              </button>
            </div>
          ) : imports.length === 0 ? (
            <div className="card mt-4 p-8 text-center text-[var(--color-ink-soft)]">No imports yet.</div>
          ) : (
            <div className="card mt-4 divide-y divide-[var(--color-line)] p-0">
              {imports.map((i) => (
                <div key={i.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className="rounded-full px-2.5 py-1 font-semibold text-white"
                      style={{ background: STATUS_COLOR[i.status] || "var(--color-ink)" }}
                    >
                      {i.status.replace("_", " ")}
                    </span>
                    {i.detected_category && (
                      <span className="rounded-full bg-[var(--color-line)] px-2.5 py-1 font-semibold">
                        {i.detected_category}
                      </span>
                    )}
                    <span className="text-[var(--color-ink-soft)]">{i.source_label}</span>
                    {i.confidence !== null && (
                      <span className="text-[var(--color-ink-soft)]">confidence {i.confidence}%</span>
                    )}
                    <span className="ml-auto text-[var(--color-ink-soft)]">
                      {new Date(i.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{i.row_count} rows stored</p>
                  {i.explanation && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{i.explanation}</p>}
                  {i.issues && i.issues.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-[var(--color-terracotta)]">
                      {i.issues.map((issue, idx) => (
                        <li key={idx}>• {issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
