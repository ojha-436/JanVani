"use client";

/* ------------------------------------------------------------------
   Bulk complaint upload (MP dashboard).

   The MP's office often holds complaint registers outside the app —
   paper logs digitised to Excel, helpline exports, camp registers.
   This card lets them download the exact expected format (CSV/Excel),
   upload the filled file, and see the rows land in the same pipeline
   as citizen voices: counted in the KPIs, ranked for priority, and
   plotted on the demand map.
   ------------------------------------------------------------------ */

import { useRef, useState } from "react";

type Result = {
  ok: boolean;
  imported?: number;
  skippedCount?: number;
  skipped?: { row: number; reason: string }[];
  truncated?: number;
  error?: string;
  reason?: string;
};

export function BulkUpload({ onImported }: { onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/bulk", { method: "POST", body: fd });
      const data: Result = await res.json();
      setResult(data);
      if (data.ok) {
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        onImported();
      }
    } catch {
      setResult({ ok: false, error: "Upload failed — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>
        Bulk complaint upload
      </h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Import complaint registers (helpline exports, camp registers, digitised paper logs) as a CSV or Excel
        file. Imported rows are counted, prioritised and mapped exactly like citizen voices. Only the{" "}
        <strong>complaint</strong> column is required — category, area, GPS, urgency, date and citizen name are
        optional.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href="/api/bulk?template=csv" download className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold transition-colors hover:border-[var(--color-ink-soft)]">
          ⬇ CSV template
        </a>
        <a href="/api/bulk?template=xlsx" download className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold transition-colors hover:border-[var(--color-ink-soft)]">
          ⬇ Excel template
        </a>
        <span className="text-xs text-[var(--color-ink-soft)]">Fill the template, then upload it below (max 1,000 rows per file).</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-[var(--color-line)] file:bg-[var(--color-paper)] file:px-4 file:py-2 file:text-sm file:font-semibold"
          aria-label="Choose CSV or Excel file"
        />
        <button
          onClick={upload}
          disabled={!file || busy}
          className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-semibold text-[var(--color-paper)] transition-opacity disabled:opacity-40"
        >
          {busy ? "Uploading…" : "Upload & rank"}
        </button>
      </div>

      {result && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{
            backgroundColor: result.ok ? "rgba(79,111,96,0.12)" : "rgba(182,74,52,0.12)",
            color: result.ok ? "var(--color-sage)" : "var(--color-terracotta)",
          }}
          role="status"
        >
          {result.ok ? (
            <>
              <strong>{result.imported}</strong> complaint{result.imported === 1 ? "" : "s"} imported and ranked.
              {Boolean(result.skippedCount) && <> {result.skippedCount} row{result.skippedCount === 1 ? "" : "s"} skipped.</>}
              {Boolean(result.truncated) && <> {result.truncated} row{result.truncated === 1 ? "" : "s"} beyond the 1,000-row cap were ignored.</>}
              {(result.skipped?.length ?? 0) > 0 && (
                <ul className="mt-1.5 list-inside list-disc text-xs opacity-90">
                  {result.skipped!.slice(0, 5).map((s) => (
                    <li key={s.row}>Row {s.row}: {s.reason}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>{result.error || (result.reason === "no-db" ? "Backend is in demo mode — bulk upload needs the live database." : "Upload failed.")}</>
          )}
        </div>
      )}
    </section>
  );
}
