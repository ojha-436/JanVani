"use client";

/* ------------------------------------------------------------------
   Gemini dashboard assistant.

   A floating chat the MP can use to interrogate the dashboard in plain
   language ("what's rising in Meskaur?", "what have we acted on?") and
   to drive it ("mark the Rajauli road in progress"). Answers are grounded
   server-side in the live ranking + momentum + status. Any action the
   assistant proposes is shown as a Confirm button — nothing changes until
   the MP clicks it (answer-and-confirm, never a silent write).
   ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { STATUS_META, type AssistantAction, type WorkStatusValue } from "@/lib/dashboardData";

type Msg = { role: "user" | "assistant"; content: string; action?: AssistantAction; actionDone?: WorkStatusValue | "dismissed" };

const SUGGESTIONS = ["What demand is rising?", "Summarise the top priorities", "What have we acted on?"];

export function AssistantChat({ isLive, onActionApplied }: { isLive: boolean; onActionApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hello. Ask me about citizen demand, what's rising, or tell me to update a work's status." },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json();
      setMsgs((prev) => [...prev, { role: "assistant", content: data.reply || "…", action: data.action }]);
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", content: "Sorry — I couldn't reach the assistant just now." }]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(i: number, action: AssistantAction) {
    setMsgs((prev) => prev.map((m, j) => (j === i ? { ...m, actionDone: action.status } : m)));
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workId: action.workId, workTitle: action.workTitle, status: action.status }),
      });
      onActionApplied();
      setMsgs((prev) => [
        ...prev,
        { role: "assistant", content: `Done — "${action.workTitle}" is now ${STATUS_META[action.status].label}. It's live on the public board too.` },
      ]);
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", content: "That change didn't save — please try from the work card." }]);
    }
  }

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-paper)] shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Close assistant" : "Open dashboard assistant"}
      >
        {open ? <span className="text-2xl leading-none">×</span> : <SparkIcon />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[32rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-paper)]">
              <SparkIcon small />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Dashboard assistant</p>
              <p className="text-[0.7rem] text-[var(--color-ink-soft)]">{isLive ? "Grounded in live data" : "Grounded in sample data"} · Gemini</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                      : "bg-[var(--color-paper-deep)] text-[var(--color-ink)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.action && !m.actionDone && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => confirmAction(i, m.action!)}
                        className="rounded-full bg-[var(--color-sage)] px-3 py-1 text-xs font-bold text-white"
                      >
                        Confirm: {STATUS_META[m.action.status].label}
                      </button>
                      <button
                        onClick={() => setMsgs((prev) => prev.map((x, j) => (j === i ? { ...x, actionDone: "dismissed" } : x)))}
                        className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                  {m.actionDone && m.actionDone !== "dismissed" && (
                    <p className="mt-1.5 text-xs font-semibold text-[var(--color-sage)]">✓ Applied</p>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-[var(--color-ink-soft)]">Thinking…</p>}
          </div>

          {msgs.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)] hover:border-[var(--color-ink-soft)]">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-[var(--color-line)] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the dashboard…"
              className="min-w-0 flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              aria-label="Message the assistant"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-paper)] disabled:opacity-40"
              aria-label="Send"
            >
              ↑
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function SparkIcon({ small }: { small?: boolean }) {
  const s = small ? 16 : 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" fill="currentColor" />
    </svg>
  );
}
