"use client";

/* ------------------------------------------------------------------
   Super-admin console — provision MP accounts per constituency.

   No shared passwords: allocate an official Lok Sabha constituency to an
   MP's email (individually or by bulk CSV/Excel) and send the returned
   one-time invite link. Deactivate revokes access instantly. Gated by a
   server-side admin key (kept in sessionStorage for this tab only).
   ------------------------------------------------------------------ */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { inviteLink, type MpAllocation, type MpStatus } from "@/lib/mp";
import { CONSTITUENCIES_BY_STATE, constituencyLabel } from "@/lib/constituencies";

const STATUS_STYLE: Record<MpStatus, { color: string; bg: string }> = {
  invited: { color: "var(--color-marigold-deep)", bg: "rgba(227,154,28,0.14)" },
  active: { color: "var(--color-sage)", bg: "rgba(79,111,96,0.14)" },
  revoked: { color: "var(--color-terracotta)", bg: "rgba(182,74,52,0.14)" },
};

type BulkRow = { row: number; email: string; constituency?: string; ok: boolean; link?: string; error?: string };

export default function AdminMpsPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<MpAllocation[]>([]);
  const [form, setForm] = useState({ email: "", name: "", constituency: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; failed: number; results: BulkRow[] } | null>(null);

  useEffect(() => {
    const k = sessionStorage.getItem("janvaani.adminKey");
    if (k) {
      setKey(k);
      setAuthed(true);
    }
  }, []);

  const load = useCallback(async (k: string) => {
    const res = await fetch("/api/mp", { headers: { "x-admin-key": k } });
    const data = await res.json();
    if (data.ok) {
      setItems(data.items);
      setAuthed(true);
      sessionStorage.setItem("janvaani.adminKey", k);
      setMsg(null);
    } else {
      setAuthed(false);
      setMsg(data.error || "Could not load. Check the admin key.");
    }
  }, []);

  useEffect(() => {
    if (authed && key) load(key);
  }, [authed, key, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setLastLink(null);
    try {
      const res = await fetch("/api/mp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setLastLink(new URL(data.link, window.location.origin).toString());
        setForm({ email: "", name: "", constituency: "" });
        setMsg(`Invite created for ${data.email} → ${data.constituency}.`);
        load(key);
      } else setMsg(data.error || data.note || "Could not create the invite.");
    } catch {
      setMsg("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkUpload(file: File) {
    setBulkBusy(true);
    setBulkResult(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/mp/bulk", { method: "POST", headers: { "x-admin-key": key }, body: fd });
      const data = await res.json();
      if (data.ok) {
        setBulkResult({ created: data.created, failed: data.failed, results: data.results });
        load(key);
      } else setMsg(data.error || data.note || "Bulk upload failed.");
    } catch {
      setMsg("Bulk upload failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function changeAccess(token: string, action: "deactivate" | "reactivate") {
    await fetch("/api/mp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ token, action }),
    }).catch(() => {});
    load(key);
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => setMsg("Link copied to clipboard."));
  }

  if (!authed) {
    return (
      <Shell>
        <h1 className="display-lg">Admin console</h1>
        <p className="mt-2 text-[var(--color-ink-soft)]">Enter the admin key to provision MP accounts.</p>
        <form onSubmit={(e) => { e.preventDefault(); load(key); }} className="mt-6 flex max-w-sm gap-2">
          <input type="password" className="field" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          <button className="btn btn-primary shrink-0" disabled={!key}>Unlock</button>
        </form>
        {msg && <p className="mt-3 text-sm text-[var(--color-terracotta)]">{msg}</p>}
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="display-lg">MP accounts</h1>
        <button className="text-sm font-semibold underline" onClick={() => { sessionStorage.removeItem("janvaani.adminKey"); setAuthed(false); setItems([]); }}>
          Lock
        </button>
      </div>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        Allocate an official Lok Sabha constituency to an MP&apos;s email and send the one-time invite link. MPs never choose their own constituency.
      </p>

      {/* single create */}
      <form onSubmit={create} className="card mt-6 grid gap-4 p-6 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="c-email">MP email</label>
          <input id="c-email" type="email" required className="field" placeholder="mp@example.gov.in" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="c-name">Name (optional)</label>
          <input id="c-name" className="field" placeholder="Hon'ble MP name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="c-con">Constituency</label>
          <select id="c-con" required className="field" value={form.constituency} onChange={(e) => setForm((f) => ({ ...f, constituency: e.target.value }))}>
            <option value="">Select constituency…</option>
            {CONSTITUENCIES_BY_STATE.map((g) => (
              <optgroup key={g.state} label={g.state}>
                {g.items.map((c) => (
                  <option key={`${g.state}-${c.no}`} value={c.name}>{constituencyLabel(c)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create invite"}</button>
        </div>
      </form>

      {msg && <p className="mt-3 text-sm text-[var(--color-sage)]">{msg}</p>}
      {lastLink && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--color-paper-deep)] px-4 py-3 text-sm">
          <code className="min-w-0 flex-1 truncate">{lastLink}</code>
          <button className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold" onClick={() => copy(lastLink)}>Copy</button>
        </div>
      )}

      {/* bulk upload */}
      <section className="card mt-6 p-6">
        <h2 className="font-display text-xl" style={{ fontWeight: 560 }}>Bulk provisioning</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Assign many MPs at once. Download the template, fill email · name · constituency, and upload. Each row returns an invite link.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a href={`/api/mp/bulk?template=csv`} download className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-ink-soft)]">⬇ CSV template</a>
          <a href={`/api/mp/bulk?template=xlsx`} download className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-ink-soft)]">⬇ Excel template</a>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={bulkBusy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) bulkUpload(f); e.target.value = ""; }}
            className="text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-[var(--color-line)] file:bg-[var(--color-paper)] file:px-4 file:py-2 file:text-sm file:font-semibold"
            aria-label="Upload MP accounts file"
          />
          {bulkBusy && <span className="text-sm text-[var(--color-ink-soft)]">Uploading…</span>}
        </div>
        {bulkResult && (
          <div className="mt-4 rounded-xl bg-[var(--color-paper-deep)] px-4 py-3 text-sm">
            <p><strong>{bulkResult.created}</strong> provisioned{bulkResult.failed ? `, ${bulkResult.failed} failed` : ""}.</p>
            {bulkResult.results.some((r) => !r.ok) && (
              <ul className="mt-1.5 list-inside list-disc text-xs text-[var(--color-terracotta)]">
                {bulkResult.results.filter((r) => !r.ok).slice(0, 8).map((r) => <li key={r.row}>Row {r.row} ({r.email || "—"}): {r.error}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* allocations */}
      <h2 className="mt-10 font-display text-xl" style={{ fontWeight: 560 }}>Allocations ({items.length})</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-ink-soft)]">
              <th className="py-2 pr-4 font-semibold">Email</th>
              <th className="py-2 pr-4 font-semibold">Constituency</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 pr-4 font-semibold">Invite link</th>
              <th className="py-2 font-semibold">Access</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="py-4 text-[var(--color-ink-soft)]">No MP accounts yet.</td></tr>
            ) : (
              items.map((m) => {
                const st = STATUS_STYLE[m.status] ?? STATUS_STYLE.invited;
                return (
                  <tr key={m.inviteToken} className="border-b border-[var(--color-line)]">
                    <td className="py-2.5 pr-4">{m.email}</td>
                    <td className="py-2.5 pr-4">{m.constituency}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: st.color, backgroundColor: st.bg }}>{m.status}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold" onClick={() => copy(new URL(inviteLink(m.inviteToken), window.location.origin).toString())}>Copy link</button>
                    </td>
                    <td className="py-2.5">
                      {m.status === "revoked" ? (
                        <button className="rounded-full border border-[var(--color-sage)] px-3 py-1 text-xs font-semibold text-[var(--color-sage)]" onClick={() => changeAccess(m.inviteToken, "reactivate")}>Reactivate</button>
                      ) : (
                        <button className="rounded-full border border-[var(--color-terracotta)] px-3 py-1 text-xs font-semibold text-[var(--color-terracotta)]" onClick={() => changeAccess(m.inviteToken, "deactivate")}>Deactivate</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-line)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-display text-lg" style={{ fontWeight: 560 }}>JanVaani</span>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-terracotta)]">Admin</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10">{children}</main>
    </div>
  );
}
