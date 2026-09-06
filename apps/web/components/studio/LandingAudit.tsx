"use client";
/**
 * "Audit my landing page" — a per-user tool. The user pastes their landing page
 * copy and their own connected AI (lib/ai) runs a Ryan Deiss audit; findings
 * are scored strong/weak/missing with a concrete fix each. Self-contained
 * modal, opened from the command palette. A BYO request goes straight to the
 * provider; with no personal key it uses the included managed AI (via our server).
 */
import { useState } from "react";
import { Modal } from "./Modal";
import { GroundingChips } from "../campaign/GroundingChips";
import { callAI, loadConnection } from "../../lib/ai/client";
import { loadGrounding, withGrounding, type Grounding } from "../../lib/ai-grounding";
import { buildAuditPrompt, parseAudit, type LandingAudit as Audit, type FindingStatus } from "../../lib/studio/landing-audit";
import { copyText } from "../../lib/clipboard";

const PRINCIPLE_LABEL: Record<string, string> = {
  rule_of_one: "Rule of One", headline: "Headline", problem_agitation: "Problem / agitation",
  single_cta: "One CTA", social_proof: "Social proof", risk_reversal: "Risk reversal",
  value_stack: "Value stack", objection_handling: "Objection handling", lead_magnet: "Lead magnet",
  grunt_test: "Grunt test",
};
const STATUS_STYLE: Record<FindingStatus, { label: string; color: string; bg: string }> = {
  strong: { label: "Strong", color: "var(--good-border)", bg: "var(--accent-soft)" },
  weak: { label: "Weak", color: "var(--warn-text)", bg: "var(--warn-bg)" },
  missing: { label: "Missing", color: "var(--bad-text, #d33)", bg: "var(--bad-bg)" },
};

export function LandingAudit({ onClose, pageLabel, initialText, onScore }: {
  onClose: () => void; pageLabel?: string | null; initialText?: string; onScore?: (score: number) => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<Grounding | null>(null);

  const run = async () => {
    const conn = loadConnection();
    if (!conn || conn.provider === "manual") { setErr("Connect an AI provider first (Campaign Studio or the Copilot)."); return; }
    if (text.trim().length < 30) { setErr("Paste more of the page — headline, subhead, body and CTA."); return; }
    setBusy(true); setErr(""); setAudit(null);
    try {
      const { system, user } = buildAuditPrompt(text);
      const g = await loadGrounding();
      setGrounding(g);
      const reply = await callAI(conn, system, withGrounding(g, user), 900);
      const parsed = parseAudit(reply);
      if (!parsed) { setErr("The AI didn't return a usable audit — try again."); return; }
      setAudit(parsed);
      onScore?.(parsed.score);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't run the audit.");
    } finally { setBusy(false); }
  };

  return (
    <Modal title={pageLabel ? `Audit: ${pageLabel}` : "Audit my landing page"} onClose={onClose}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your landing page copy — headline, subhead, body, CTA…"
            style={{ width: "100%", boxSizing: "border-box", minHeight: 120, resize: "vertical", background: "var(--surface2)", border: "1px solid var(--border3)", color: "var(--text)", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={run} disabled={busy} style={{ background: "var(--good-border)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 500, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Auditing…" : "Run Deiss audit"}
            </button>
            {grounding && <GroundingChips brand={grounding.brand} strategy={grounding.strategy} />}
            {err && <span style={{ fontSize: 12, color: "var(--bad-text, #d33)" }}>{err}</span>}
          </div>

          {audit && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: "var(--good-border)", fontVariantNumeric: "tabular-nums" }}>{audit.score}</span>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>/ 100</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{audit.summary}</span>
              </div>
              {audit.findings.map((f) => {
                const s = STATUS_STYLE[f.status];
                return (
                  <div key={f.principle} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: s.color, background: s.bg, padding: "2px 7px", borderRadius: 6 }}>{s.label}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{PRINCIPLE_LABEL[f.principle] ?? f.principle}</span>
                    </div>
                    {f.note && <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{f.note}</div>}
                    {f.fix && f.status !== "strong" && (
                      <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 4, display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ flex: 1 }}><b>Fix:</b> {f.fix}</span>
                        <button
                          onClick={() => { void copyText(f.fix).then((ok) => { if (ok) { setCopied(f.principle); setTimeout(() => setCopied((c) => (c === f.principle ? null : c)), 1400); } }); }}
                          style={{ flexShrink: 0, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", borderRadius: 6, padding: "2px 7px", fontSize: 11, cursor: "pointer" }}>
                          {copied === f.principle ? "Copied ✓" : "Copy fix"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
    </Modal>
  );
}
