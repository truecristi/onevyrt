"use client";
/**
 * Generic "✨ Draft with AI" affordance for a single text field — the reusable
 * core behind AI editing across the app (block notes, business-definition
 * fields, …). Given a system + user prompt it fills the field via the shared
 * connected provider (a BYO request goes straight to the provider; with no
 * personal key it falls back to the included managed AI via our server); if
 * nothing can generate it points the user to Campaign Studio rather than
 * failing silently.
 */
import { useState } from "react";
import { streamAI, loadConnection } from "../../lib/ai/client";
import { MarketingIcon } from "../MarketingIcons";

export function AiFieldButton({ system, user, onDraft, label = "Draft with AI", maxTokens = 260 }: {
  system: string;
  user: string;
  onDraft: (text: string) => void;
  label?: string;
  maxTokens?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    if (busy) return;
    setErr("");
    const conn = loadConnection();
    if (!conn || conn.provider === "manual") {
      setErr("Connect an AI provider in Campaign Studio first.");
      return;
    }
    setBusy(true);
    try {
      // Stream so the field fills in as the model writes, not all at once.
      let acc = "";
      await streamAI(conn, system, user, (d) => { acc += d; onDraft(acc.replace(/^\s+/, "")); }, maxTokens);
      onDraft(acc.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't generate.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={run} disabled={busy}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", color: "var(--good-border)", border: "1px solid var(--good-border)", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 500, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "Drafting…" : <><MarketingIcon name="spark" size={12} /> {label}</>}
      </button>
      {err && <span style={{ fontSize: 10.5, color: "var(--bad-border)", marginLeft: 6 }}>{err}</span>}
    </>
  );
}
