"use client";
/**
 * SellBetter — paste any copy, get it scored (hook / clarity / emotion / CTA)
 * and rewritten to sell harder, grounded in the saved Message. Reusable and
 * self-scoped ("sb-" prefix) so it can be a standalone tool or embedded next to
 * any asset editor. Uses the existing callAI + loadConnection pattern.
 */
import { useCallback, useEffect, useState } from "react";
import { useToast } from "./Toast";
import { GroundingChips } from "./campaign/GroundingChips";
import { callAI, loadConnection } from "../lib/ai/client";
import { loadGrounding, withGrounding, type Grounding } from "../lib/ai-grounding";
import { SELL_BETTER_SYSTEM, buildSellBetterPrompt, parseSellBetter, type AssetKind, type SellBetterResult } from "../lib/studio/sell-better";
import { strategyContext, type GoldenExample } from "../lib/studio/golden-example";
import type { MessageInput } from "../lib/studio/message-copy";
import { copyText } from "../lib/clipboard";

const KINDS: { id: AssetKind; label: string }[] = [
  { id: "headline", label: "Headline" },
  { id: "subject", label: "Email subject" },
  { id: "email", label: "Email" },
  { id: "landing", label: "Landing copy" },
  { id: "ad", label: "Ad" },
  { id: "generic", label: "Other" },
];

const DIMS: { key: keyof SellBetterResult["scores"]; label: string }[] = [
  { key: "hook", label: "Hook" },
  { key: "clarity", label: "Clarity" },
  { key: "emotion", label: "Emotion" },
  { key: "cta", label: "Call to action" },
];

export interface SellBetterProps {
  initialText?: string;
  kind?: AssetKind;
  /** External prefill: when this changes to a non-empty value, it replaces the
   *  textarea contents (e.g. the "Use this example" button on the page). */
  prefill?: string;
  /** Bump this on every prefill click so re-applying the SAME text still works
   *  (a string-identity effect would bail when the user edits then re-clicks). */
  prefillNonce?: number;
  /** When provided, shows a "Use this" button that hands the rewrite back. */
  onUse?: (text: string) => void;
}

export default function SellBetter({ initialText = "", kind = "generic", prefill, prefillNonce, onUse }: SellBetterProps) {
  const toast = useToast();
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [golden, setGolden] = useState<GoldenExample | null>(null);
  const [text, setText] = useState(initialText);
  // Apply an external prefill (worked-example "Use this") without clobbering
  // anything the user typed once they start editing.
  useEffect(() => { if (prefill && prefill.trim()) setText(prefill); }, [prefill, prefillNonce]);
  const [assetKind, setAssetKind] = useState<AssetKind>(kind);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SellBetterResult | null>(null);
  const [copied, setCopied] = useState(false);
  // Surfaces what loadGrounding() feeds the rewrite (Brand Brain / strategy)
  // via GroundingChips, so the grounding used below isn't invisible to the user.
  const [g, setG] = useState<Grounding | null>(null);
  useEffect(() => { void loadGrounding().then(setG); }, []);

  const loadMsg = useCallback(async () => {
    try {
      const [r, rg] = await Promise.all([
        fetch("/api/business/message", { credentials: "include" }),
        fetch("/api/business/golden-example", { credentials: "include" }),
      ]);
      if (r.ok) setMsg((await r.json()) as MessageInput);
      if (rg.ok) { const g = await rg.json(); if (g && Array.isArray(g.ladder) && g.ladder.length) setGolden(g as GoldenExample); }
    } catch { /* grounding is optional */ }
  }, []);
  useEffect(() => { void loadMsg(); }, [loadMsg]);

  const improve = async () => {
    const copy = text.trim();
    if (!copy) { toast("Paste some copy to improve first.", "error"); return; }
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setBusy(true); setResult(null);
    try {
      const g = await loadGrounding();
      const reply = await callAI(conn, SELL_BETTER_SYSTEM, withGrounding(g, buildSellBetterPrompt(copy, assetKind, msg, strategyContext(golden))), 700);
      const r = parseSellBetter(reply);
      if (!r) { toast("The model didn't return a usable rewrite — try again.", "error"); return; }
      setResult(r);
    } catch (e) { toast(e instanceof Error ? e.message : "Rewrite failed — check your AI connection.", "error"); }
    finally { setBusy(false); }
  };

  const copyRewrite = async () => {
    if (!result) return;
    if (await copyText(result.rewrite)) { setCopied(true); window.setTimeout(() => setCopied(false), 1600); toast("Rewrite copied."); }
    else toast("Couldn't copy — select the text manually.", "error");
  };

  const tone = (n: number) => (n >= 80 ? "good" : n >= 50 ? "warn" : "bad");

  return (
    <section className="sb">
      <style>{CSS}</style>
      <div className="sb-in">
        <div className="sb-kinds">
          {KINDS.map((k) => (
            <button key={k.id} className={`sb-kind${assetKind === k.id ? " on" : ""}`} onClick={() => setAssetKind(k.id)}>{k.label}</button>
          ))}
        </div>
        <textarea className="sb-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a headline, an email, a landing section — anything you want to sell harder." />
        <div className="sb-gorow">
          <button className="sb-go" disabled={busy} onClick={() => void improve()}>{busy ? "Selling it better…" : "✦ Sell it better"}</button>
          <GroundingChips brand={g?.brand ?? false} strategy={g?.strategy ?? false} />
        </div>
      </div>

      {result && (
        <div className="sb-out">
          <div className="sb-scorerow">
            <div className={`sb-overall s-${tone(result.overall)}`}>
              <div className="sb-on">{result.overall}</div><div className="sb-ol">/ 100</div>
            </div>
            <div className="sb-dims">
              {DIMS.map((d) => {
                const v = result.scores[d.key];
                return (
                  <div className="sb-dim" key={d.key}>
                    <div className="sb-dim-top"><span>{d.label}</span><span className="sb-dim-n">{v}/10</span></div>
                    <div className="sb-bar"><span className={`s-${tone(v * 10)}`} style={{ width: `${v * 10}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sb-rewrite">
            <div className="sb-rw-top"><span className="sb-rw-tag">Rewrite</span>
              <div className="sb-rw-actions">
                <button className="sb-copy" onClick={() => void copyRewrite()}>{copied ? "Copied ✓" : "Copy"}</button>
                {onUse && <button className="sb-use" onClick={() => { onUse(result.rewrite); toast("Rewrite applied."); }}>Use this</button>}
              </div>
            </div>
            <p className="sb-rw-text">{result.rewrite}</p>
          </div>

          {result.tips.length > 0 && (
            <ul className="sb-tips">
              {result.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

const CSS = `
.sb{--sb-brand:var(--ds-brand,#0a9e6e);--sb-surface:var(--ds-surface,#fff);--sb-subtle:var(--ds-surface-subtle,#fafbfc);
  --sb-text:var(--ds-text-primary,#111827);--sb-muted:var(--ds-text-secondary,#475569);--sb-tert:var(--ds-text-tertiary,#64748b);--sb-border:var(--ds-border-default,#dde3eb);
  background:var(--sb-surface);border:1px solid var(--sb-border);border-radius:var(--ds-radius-lg,12px);padding:16px 18px;box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.04));color:var(--sb-text);}
.sb *{box-sizing:border-box;}
.sb-kinds{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
.sb-kind{background:var(--sb-surface);border:1px solid var(--sb-border);color:var(--sb-muted);border-radius:99px;padding:4px 12px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
.sb-kind:hover{border-color:var(--sb-brand);color:var(--sb-text);}
.sb-kind.on{background:var(--sb-brand);border-color:var(--sb-brand);color:#fff;}
.sb-text{width:100%;font-family:inherit;font-size:14px;color:var(--sb-text);background:var(--sb-surface);border:1.5px solid var(--sb-border);border-radius:9px;padding:10px 12px;resize:vertical;line-height:1.5;}
.sb-text:focus{outline:none;border-color:var(--sb-brand);}
.sb-gorow{margin-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.sb-go{background:var(--sb-brand);color:#fff;border:none;border-radius:9px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer;transition:opacity .15s;}
.sb-go:hover{opacity:.9;}
.sb-go:disabled{opacity:.6;cursor:default;}
.sb-out{margin-top:16px;padding-top:16px;border-top:1px solid var(--sb-border);}
.sb-scorerow{display:flex;gap:16px;align-items:center;flex-wrap:wrap;}
.sb-overall{flex:0 0 auto;width:78px;height:78px;border-radius:16px;border:2px solid;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.sb-overall.s-good{border-color:var(--ds-success,#15803d);color:var(--ds-success,#15803d);background:var(--ds-success-soft,#ecfdf3);}
.sb-overall.s-warn{border-color:#b45309;color:#b45309;background:#fff7ed;}
.sb-overall.s-bad{border-color:var(--ds-danger,#c81e1e);color:var(--ds-danger,#c81e1e);background:var(--ds-danger-soft,#fef2f2);}
.sb-on{font-size:26px;font-weight:700;line-height:1;letter-spacing:-.5px;}
.sb-ol{font-size:10px;font-weight:700;opacity:.75;margin-top:2px;}
.sb-dims{flex:1;min-width:200px;display:flex;flex-direction:column;gap:7px;}
.sb-dim-top{display:flex;justify-content:space-between;font-size:12px;font-weight:500;color:var(--sb-muted);margin-bottom:3px;}
.sb-dim-n{color:var(--sb-tert);}
.sb-bar{height:6px;background:var(--sb-subtle);border-radius:99px;overflow:hidden;}
.sb-bar span{display:block;height:100%;border-radius:99px;transition:width .4s ease;}
.sb-bar .s-good{background:var(--ds-success,#15803d);}
.sb-bar .s-warn{background:#d97706;}
.sb-bar .s-bad{background:var(--ds-danger,#c81e1e);}
.sb-rewrite{margin-top:14px;background:var(--sb-subtle);border:1px solid var(--sb-border);border-radius:10px;padding:12px 14px;}
.sb-rw-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px;}
.sb-rw-tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--sb-brand);}
.sb-rw-actions{display:flex;gap:6px;}
.sb-copy,.sb-use{border:none;border-radius:7px;padding:4px 11px;font-size:12px;font-weight:700;cursor:pointer;}
.sb-copy{background:var(--sb-surface);border:1px solid var(--sb-border);color:var(--sb-text);}
.sb-use{background:var(--sb-brand);color:#fff;}
.sb-rw-text{font-size:14.5px;line-height:1.55;color:var(--sb-text);margin:0;white-space:pre-wrap;}
.sb-tips{margin:12px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:5px;}
.sb-tips li{font-size:12.5px;color:var(--sb-muted);line-height:1.45;}
`;
