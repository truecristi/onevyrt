"use client";
/**
 * "Audit the whole funnel" — runs the Ryan Deiss landing audit against every
 * page block that has copy, one after another with the user's own AI key, then
 * ranks them worst-first so the user knows which page to fix next. Each block's
 * score is written back to the canvas (via onScore) as it lands. The key never
 * leaves the browser.
 */
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { GroundingChips } from "../campaign/GroundingChips";
import { callAI, loadConnection } from "../../lib/ai/client";
import { loadGrounding, withGrounding, type Grounding } from "../../lib/ai-grounding";
import { buildAuditPrompt, parseAudit } from "../../lib/studio/landing-audit";
import type { FunnelAuditTarget } from "../../lib/studio/audit-source";

type Row = { id: string; label: string; status: "pending" | "running" | "done" | "error"; score?: number; summary?: string; error?: string };

const scoreColor = (s: number) => (s >= 75 ? "var(--good-border)" : s >= 50 ? "var(--warn-text)" : "var(--bad-text)");

export function FunnelAudit({ targets, onScore, onClose }: {
  targets: FunnelAuditTarget[];
  onScore: (id: string, score: number) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => targets.map((t) => ({ id: t.id, label: t.label, status: "pending" })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [grounding, setGrounding] = useState<Grounding | null>(null);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const run = async () => {
    const conn = loadConnection();
    if (!conn || conn.provider === "manual") { setErr("Connect an AI provider first (Campaign Studio or the Copilot)."); return; }
    if (targets.length === 0) { setErr("No page blocks with copy yet — add copy to a Landing/Offer/Traffic block's note first."); return; }
    setBusy(true); setErr("");
    const g = await loadGrounding();
    setGrounding(g);
    for (const t of targets) {
      if (cancelled.current) break;
      setRows((rs) => rs.map((r) => (r.id === t.id ? { ...r, status: "running" } : r)));
      try {
        const { system, user } = buildAuditPrompt(t.text);
        const reply = await callAI(conn, system, withGrounding(g, user), 900);
        const parsed = parseAudit(reply);
        if (cancelled.current) break;
        if (!parsed) {
          setRows((rs) => rs.map((r) => (r.id === t.id ? { ...r, status: "error", error: "No usable audit" } : r)));
          continue;
        }
        onScore(t.id, parsed.score);
        setRows((rs) => rs.map((r) => (r.id === t.id ? { ...r, status: "done", score: parsed.score, summary: parsed.summary } : r)));
      } catch (e) {
        if (cancelled.current) break;
        setRows((rs) => rs.map((r) => (r.id === t.id ? { ...r, status: "error", error: e instanceof Error ? e.message : "Failed" } : r)));
      }
    }
    if (!cancelled.current) setBusy(false);
  };

  // Worst score first; unscored rows sink to the bottom.
  const ranked = [...rows].sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
  const done = rows.filter((r) => r.status === "done").length;

  return (
    <Modal title="Audit the whole funnel" onClose={onClose} width={560}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={run} disabled={busy} style={{ background: "var(--good-border)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 500, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? `Auditing… (${done}/${targets.length})` : `Audit ${targets.length} page${targets.length === 1 ? "" : "s"}`}
            </button>
            {grounding && <GroundingChips brand={grounding.brand} strategy={grounding.strategy} />}
            {err && <span style={{ fontSize: 12, color: "var(--bad-text, #d33)" }}>{err}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ranked.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px" }}>
                <span style={{ width: 42, textAlign: "center", fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.score != null ? scoreColor(r.score) : "var(--dim)" }}>
                  {r.status === "running" ? "…" : r.score != null ? r.score : r.status === "error" ? "—" : ""}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: r.status === "error" ? "var(--bad-text, #d33)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.status === "error" ? r.error : r.summary ?? (r.status === "running" ? "Auditing…" : "Not yet audited")}
                  </div>
                </div>
              </div>
            ))}
          </div>
    </Modal>
  );
}
