"use client";
/**
 * First Message — cold-outreach helper (Psychology / Copy & Creative). For the
 * founder with an offer but no audience: pick a channel, and AI drafts a few
 * short, human first messages grounded in the saved Offer + Message. Copy one,
 * fill any [placeholder], send. Reuses the callAI + loadConnection pattern.
 */
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../components/Toast";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { copyText } from "../../../lib/clipboard";
import { OUTREACH_CHANNELS, OUTREACH_SYSTEM, FOLLOWUP_SYSTEM, buildOutreachPrompt, buildFollowupPrompt, parseOutreach, type OutreachChannel } from "../../../lib/studio/outreach";
import { strategyContext, type GoldenExample } from "../../../lib/studio/golden-example";
import { loadBrandProfile, brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { EMPTY_OFFER, type OfferData } from "../../../lib/studio/offer-coach";
import type { MessageInput } from "../../../lib/studio/message-copy";

/** Render a draft with its [bracketed placeholders] highlighted so the reader
 *  can see at a glance exactly what to fill in before sending. Display-only —
 *  the Copy action always uses the raw, unhighlighted text. */
function renderMessage(text: string) {
  return text.split(/(\[[^\]]+\])/g).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? <mark className="or-ph" key={i}>{part}</mark> : part,
  );
}

export default function OutreachPage() {
  const toast = useToast();
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [golden, setGolden] = useState<GoldenExample | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  const [channel, setChannel] = useState<OutreachChannel>("dm");
  const [mode, setMode] = useState<"first" | "followup">("first");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [ro, rm, rg] = await Promise.all([
        fetch("/api/business/offer", { credentials: "include" }),
        fetch("/api/business/message", { credentials: "include" }),
        fetch("/api/business/golden-example", { credentials: "include" }),
      ]);
      if (ro.ok) setOffer({ ...EMPTY_OFFER, ...(await ro.json()) });
      if (rm.ok) setMsg((await rm.json()) as MessageInput);
      if (rg.ok) { const g = await rg.json(); if (g && Array.isArray(g.ladder) && g.ladder.length) setGolden(g as GoldenExample); }
    } catch { /* grounding is optional */ }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadBrandProfile().then(setBrand); void loadStrategyBrief().then(setStrategy); }, []);

  const grounded = !!(offer?.name?.trim() || offer?.promise?.trim() || msg?.oneLiner?.solution?.trim());

  // What each draft is grounded in — surfaced so the tool reads as systematic
  // (openers built from your real work), never a spray-and-pray bot.
  const groundItems: { label: string; on: boolean }[] = [
    { label: "Offer", on: !!(offer?.name?.trim() || offer?.promise?.trim()) },
    { label: "Message", on: !!(msg?.oneLiner?.solution?.trim() || msg?.character?.trim()) },
    { label: "Strategy", on: !!strategy?.has },
    { label: "Golden example", on: !!golden },
  ];
  const modeHelp = mode === "followup"
    ? "A gentle nudge to someone who saw your first message but hasn't replied — it leads with a fresh angle and gives an easy out, never guilt."
    : "A cold opener to someone who's never heard from you — short, about them, and ending in one low-pressure question.";

  const write = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setBusy(true); setMessages([]);
    try {
      const system = mode === "followup" ? FOLLOWUP_SYSTEM : OUTREACH_SYSTEM;
      const bizBrand = hasBrand(brand) ? `BRAND:\n${brandBrief(brand)}` : "";
      const bizStrategy = strategy?.has ? `BUSINESS STRATEGY (aim the outreach at this goal and constraint):\n${strategy.brief}` : "";
      const combinedStrategy = [bizBrand, bizStrategy, strategyContext(golden)].filter(Boolean).join("\n\n");
      const prompt = mode === "followup" ? buildFollowupPrompt(offer, msg, channel, combinedStrategy) : buildOutreachPrompt(offer, msg, channel, combinedStrategy);
      const reply = await callAI(conn, system, prompt, 700);
      const out = parseOutreach(reply);
      if (out.length === 0) { toast("The model didn't return usable messages — try again.", "error"); return; }
      setMessages(out);
    } catch (e) { toast(e instanceof Error ? e.message : "Draft failed — check your AI connection.", "error"); }
    finally { setBusy(false); }
  };

  const copy = async (i: number, text: string) => {
    if (await copyText(text)) { setCopied(i); window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 1600); toast("Copied — paste it into your DM or email."); }
    else toast("Couldn't copy — select the text manually.", "error");
  };

  return (
    <div className="or-root">
      <style>{CSS}</style>
      <div className="hub-header">
        <div>
          <div className="eyebrow">PSYCHOLOGY · FIRST MESSAGE</div>
          <h1>Reach out without freezing</h1>
          <p className="sub">No audience yet? Message people directly. Pick where you&rsquo;re reaching out and get a few short, human openers — grounded in your offer, never salesy — that actually earn a reply.</p>
        </div>
        <a href="/psychology" className="btn ghost">← Psychology</a>
      </div>

      <AIStatus />

      <WorkedExample id="outreach" />

      {!grounded && (
        <div className="or-note">
          <span className="or-note-ic" aria-hidden>✎</span>
          <span>These get much sharper once you&rsquo;ve written your <a href="/business/message">Message</a> and <a href="/psychology/offer">Offer</a> — they ground every line in your real value.</span>
        </div>
      )}

      <div className="card">
        <div className="or-modes" role="group" aria-label="Message type">
          <button type="button" aria-pressed={mode === "first"} className={`or-mode${mode === "first" ? " on" : ""}`} onClick={() => { setMode("first"); setMessages([]); }}>First message</button>
          <button type="button" aria-pressed={mode === "followup"} className={`or-mode${mode === "followup" ? " on" : ""}`} onClick={() => { setMode("followup"); setMessages([]); }}>Follow-up (no reply yet)</button>
        </div>
        <p className="or-mode-help">{modeHelp}</p>

        <div className="or-label">Where are you reaching out?</div>
        <p className="or-label-hint">Each channel has its own natural length and tone — the draft adapts to fit.</p>
        <div className="or-chans" role="group" aria-label="Outreach channel">
          {OUTREACH_CHANNELS.map((c) => {
            const sel = channel === c.id;
            const wordTarget = mode === "followup" ? Math.round(c.words * 0.7) : c.words;
            return (
              <button type="button" key={c.id} aria-pressed={sel} className={`or-chan${sel ? " on" : ""}`} onClick={() => setChannel(c.id)}>
                <span className="or-chan-dot" aria-hidden />
                <span className="or-chan-l">{c.label}</span>
                <span className="or-chan-n">{c.note}</span>
                <span className="or-chan-len" aria-hidden>≤ {wordTarget} words</span>
              </button>
            );
          })}
        </div>

        <button type="button" className="btn primary or-go" disabled={busy} onClick={() => void write()}>
          {busy ? <><span className="or-spin" aria-hidden /> Writing…</> : mode === "followup" ? "✦ Write my follow-ups" : "✦ Write my first messages"}
        </button>

        <div style={{ marginTop: 8 }}><GroundingChips brand={hasBrand(brand)} strategy={!!strategy?.has} /></div>

        <div className="or-ground">
          <span className="or-ground-cap">Grounded in your real work:</span>
          <span className="or-ground-pills">
            {groundItems.map((g) => (
              <span key={g.label} className={`or-gp${g.on ? " on" : ""}`}>{g.on ? "✓ " : ""}{g.label}</span>
            ))}
          </span>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="or-out" aria-live="polite">
          <div className="or-out-head">
            <span className="or-out-eyebrow">✦ {messages.length} {messages.length === 1 ? "draft" : "drafts"} ready</span>
            <span className="or-out-sub">Pick one, fill any <span className="or-ph-inline">[brackets]</span>, and send it.</span>
          </div>
          {messages.map((m, i) => (
            <div className="or-msg" key={i}>
              <span className="or-msg-num" aria-hidden>{i + 1}</span>
              <p className="or-msg-t">{renderMessage(m)}</p>
              <button type="button" className="or-copy" aria-label={`Copy message ${i + 1}`} data-copied={copied === i} onClick={() => void copy(i, m)}>{copied === i ? "Copied ✓" : "Copy"}</button>
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && busy && (
        <div className="or-out" aria-live="polite" aria-busy="true">
          <div className="or-out-head">
            <span className="or-out-eyebrow">✦ Writing…</span>
            <span className="or-out-sub">Three short openers in your voice, grounded in your offer.</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div className="or-msg skel" key={i} aria-hidden>
              <span className="or-msg-num" />
              <div className="or-skel"><span /><span /><span /></div>
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && !busy && (
        <div className="or-empty">
          <div className="or-empty-ic" aria-hidden>✉</div>
          <p className="or-empty-t">Your openers will appear here</p>
          <p className="or-empty-s">Pick a mode and channel above, then generate. You&rsquo;ll get three short, copy-ready messages — fill any <span className="or-ph-inline">[brackets]</span> and send.</p>
        </div>
      )}

      <div className="or-foot">
        <span className="or-foot-ic" aria-hidden>ⓘ</span>
        <p>Tip: send from a real, personal account — no logos or link-first messages. The goal of message one is a reply, not a sale.</p>
      </div>
    </div>
  );
}

const CSS = `
.or-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-radius-lg:12px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .or-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.or-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.hub-header h1{font-size:26px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:66ch;line-height:1.55;}
.btn{font:inherit;font-size:13px;font-weight:700;border-radius:9px;padding:9px 15px;cursor:pointer;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);text-decoration:none;display:inline-block;}
.btn.ghost{background:transparent;}
.btn.ghost:hover{transform:translateY(-1px);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:disabled{opacity:.6;cursor:default;}
.or-go{width:100%;margin-top:2px;}
.or-go:not(:disabled):hover{transform:translateY(-1px);}
.or-note{display:flex;gap:9px;align-items:flex-start;background:var(--ds-brand-soft);border:1px solid color-mix(in srgb,var(--ds-brand) 30%,transparent);border-radius:10px;padding:11px 14px;font-size:13px;line-height:1.5;color:var(--muted);margin-bottom:14px;}
.or-note-ic{color:var(--ds-brand);font-weight:700;flex:0 0 auto;}
.or-note a{color:var(--ds-brand-hover);font-weight:700;text-decoration:underline;text-underline-offset:2px;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 18px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.or-modes{display:inline-flex;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:99px;padding:3px;margin-bottom:10px;}
.or-mode{background:none;border:none;border-radius:99px;padding:6px 14px;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;transition:background .15s ease,color .15s ease;}
.or-mode:hover{color:var(--text);}
.or-mode.on{background:var(--ds-brand);color:#fff;box-shadow:0 1px 2px rgba(15,23,42,.15);}
.or-mode:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.or-mode-help{font-size:12.5px;line-height:1.5;color:var(--ds-text-tertiary);margin:0 2px 16px;}
.or-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);margin-bottom:3px;}
.or-label-hint{font-size:12px;line-height:1.45;color:var(--ds-text-tertiary);margin:0 0 10px;}
.or-chans{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;}
@media(max-width:560px){.or-chans{grid-template-columns:1fr;}}
.or-chan{position:relative;text-align:left;background:var(--ds-surface-subtle);border:1.5px solid var(--border);border-radius:10px;padding:11px 34px 11px 12px;cursor:pointer;display:flex;flex-direction:column;gap:4px;font-family:inherit;transition:border-color .15s ease,background .15s ease,transform .15s ease,box-shadow .15s ease;}
.or-chan:hover{border-color:var(--border-strong);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));}
.or-chan:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.or-chan.on{border-color:var(--ds-brand);background:var(--ds-brand-soft);box-shadow:0 0 0 3px color-mix(in srgb,var(--ds-brand) 14%,transparent);}
.or-chan-l{font-size:13.5px;font-weight:700;color:var(--text);}
.or-chan.on .or-chan-l{color:var(--ds-brand);}
.or-chan-n{font-size:11.5px;color:var(--ds-text-tertiary);line-height:1.4;}
.or-chan-len{margin-top:2px;font-size:10.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--ds-text-tertiary);}
.or-chan.on .or-chan-len{color:var(--ds-brand-hover);}
.or-chan-dot{position:absolute;top:11px;right:11px;width:17px;height:17px;border-radius:50%;border:1.5px solid var(--ds-border-strong);background:var(--surface);transition:background .15s ease,border-color .15s ease;}
.or-chan.on .or-chan-dot{border-color:var(--ds-brand);background:var(--ds-brand);}
.or-chan.on .or-chan-dot::after{content:"✓";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;line-height:1;}
.or-spin{width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;display:inline-block;vertical-align:-1px;animation:or-spin .7s linear infinite;}
@keyframes or-spin{to{transform:rotate(360deg);}}
.or-ground{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);}
.or-ground-cap{font-size:11.5px;font-weight:700;color:var(--ds-text-tertiary);}
.or-ground-pills{display:inline-flex;flex-wrap:wrap;gap:6px;}
.or-gp{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;border:1px solid var(--border);background:var(--ds-surface-subtle);color:var(--ds-text-tertiary);}
.or-gp.on{background:var(--ds-brand-soft);border-color:color-mix(in srgb,var(--ds-brand) 35%,transparent);color:var(--ds-brand);}
.or-out{margin-top:6px;}
.or-out-head{display:flex;flex-direction:column;gap:2px;margin-bottom:12px;}
.or-out-eyebrow{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--ds-brand);}
.or-out-sub{font-size:13px;color:var(--muted);line-height:1.5;}
.or-ph-inline{background:var(--ds-warning-soft);color:var(--ds-warning);border-radius:4px;padding:0 4px;font-weight:700;font-size:.92em;}
.or-msg{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;box-shadow:var(--ds-shadow-xs);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;}
.or-msg:not(.skel):hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-md,0 8px 24px -6px rgba(15,23,42,.12));border-color:var(--border-strong);}
.or-msg-num{flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px;}
.or-msg-t{flex:1;font-size:14.5px;line-height:1.55;color:var(--text);margin:0;white-space:pre-wrap;}
.or-ph{background:var(--ds-warning-soft);color:var(--ds-warning);border-radius:4px;padding:0 3px;font-weight:700;-webkit-box-decoration-break:clone;box-decoration-break:clone;}
.or-copy{flex:0 0 auto;background:var(--ds-brand);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s ease,transform .15s ease;}
.or-copy:hover{background:var(--ds-brand-hover);transform:translateY(-1px);}
.or-copy:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.or-copy[data-copied="true"]{background:var(--ds-success);}
.or-skel{flex:1;display:flex;flex-direction:column;gap:7px;padding:3px 0;}
.or-skel span{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--ds-bg-subtle) 25%,var(--ds-surface-subtle) 37%,var(--ds-bg-subtle) 63%);background-size:400% 100%;animation:or-shimmer 1.4s ease infinite;}
.or-skel span:nth-child(1){width:92%;}
.or-skel span:nth-child(2){width:100%;}
.or-skel span:nth-child(3){width:58%;}
.or-msg.skel .or-msg-num{background:var(--ds-bg-subtle);}
@keyframes or-shimmer{to{background-position:-125% 0;}}
.or-empty{border:1.5px dashed var(--border-strong);border-radius:12px;padding:26px 20px;text-align:center;background:var(--ds-surface-subtle);}
.or-empty-ic{width:42px;height:42px;margin:0 auto 10px;border-radius:12px;background:var(--ds-brand-soft);color:var(--ds-brand);font-size:20px;display:flex;align-items:center;justify-content:center;}
.or-empty-t{font-size:14px;font-weight:700;color:var(--text);margin:0 0 4px;}
.or-empty-s{font-size:12.5px;line-height:1.55;color:var(--ds-text-tertiary);margin:0 auto;max-width:44ch;}
.or-foot{display:flex;gap:9px;align-items:flex-start;margin:14px 0 0;padding:11px 14px;background:var(--ds-info-soft);border:1px solid color-mix(in srgb,var(--ds-info) 22%,transparent);border-left:3px solid var(--ds-info);border-radius:10px;}
.or-foot-ic{color:var(--ds-info);font-weight:700;flex:0 0 auto;font-size:13px;line-height:1.5;}
.or-foot p{font-size:12.5px;color:var(--muted);margin:0;line-height:1.5;}
@media (prefers-reduced-motion: reduce){.or-root *{transition:none!important;animation:none!important;}}
`;
