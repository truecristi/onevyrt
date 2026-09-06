"use client";
/**
 * "Draft with AI" for a funnel block's planning notes — brings the connected
 * AI provider (Campaign Studio's BYO-key, shared via lib/ai/client's
 * localStorage) onto the canvas so notes can be generated in place, not only
 * in the copywriter. Two actions: Draft (generate/append) and — once there's
 * content — Tighten (rewrite the existing note to be clearer and shorter).
 * Uses the exact same connection the rest of the app does; if nothing is
 * connected it points the user to where they connect it rather than failing
 * silently. A BYO request goes straight to the provider; with no personal key
 * it falls back to the included managed AI (via our server).
 */
import { useState } from "react";
import { streamAI, loadConnection } from "../../lib/ai/client";
import { MarketingIcon } from "../MarketingIcons";

export function NotesAiDraft({ label, kind, current, onDraft }: {
  label: string; kind: string; current: string; onDraft: (text: string) => void;
}) {
  const [busy, setBusy] = useState<"" | "draft" | "tighten">("");
  const [err, setErr] = useState("");
  const hasContent = current.trim().length > 0;

  const call = async (mode: "draft" | "tighten") => {
    if (busy) return;
    setErr("");
    const conn = loadConnection();
    if (!conn || conn.provider === "manual") {
      setErr("Connect an AI provider in Campaign Studio first — then it works here too.");
      return;
    }
    setBusy(mode);
    try {
      if (mode === "tighten") {
        const system = "You are an editor. Rewrite the given planning note to be clearer, tighter and more concrete — same meaning, fewer words, no fluff. Return ONLY the rewritten note as plain text, no preamble.";
        // Replace — tighten is a rewrite, not an append. Stream in place.
        let acc = "";
        await streamAI(conn, system, `Rewrite this planning note:\n\n${current.trim()}`, (d) => { acc += d; onDraft(acc.replace(/^\s+/, "")); }, 300);
        onDraft(acc.trim());
      } else {
        const system = "You are a growth strategist helping plan a marketing funnel. Write concise, practical planning notes for ONE funnel block: 2–4 short sentences covering why the block exists, the main thing to test or watch, and one concrete tip. Plain text, no preamble, no headings.";
        // Append under any existing note; stream the new text below it.
        const base = hasContent ? `${current.trim()}\n\n` : "";
        let acc = "";
        await streamAI(conn, system, `Funnel block: "${label}" (type: ${kind}). Write its planning notes.`, (d) => { acc += d; onDraft(base + acc.replace(/^\s+/, "")); }, 300);
        onDraft(base + acc.trim());
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't generate notes.");
    } finally {
      setBusy("");
    }
  };

  const btn = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-soft)", color: "var(--good-border)", border: "1px solid var(--good-border)", borderRadius: 11, padding: "5px 11px", fontSize: 12, fontWeight: 500 } as const;

  return (
    <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button onClick={() => call("draft")} disabled={!!busy} style={{ ...btn, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy === "draft" ? "Drafting…" : <><MarketingIcon name="spark" size={12} /> Draft with AI</>}
      </button>
      {hasContent && (
        <button onClick={() => call("tighten")} disabled={!!busy}
          style={{ ...btn, background: "transparent", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy === "tighten" ? "Tightening…" : <><MarketingIcon name="spark" size={12} /> Tighten</>}
        </button>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--bad-border)", width: "100%" }}>{err}</div>}
    </div>
  );
}
