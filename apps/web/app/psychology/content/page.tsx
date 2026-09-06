"use client";
/**
 * Content Angles — the 1-to-many road to an audience (Psychology / Copy &
 * Creative), complement to First Message. Generates scroll-stopping post ideas
 * grounded in the saved Offer + Message so a founder starting from zero always
 * has something worth posting. Reuses the callAI + loadConnection pattern.
 */
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../components/Toast";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { copyText } from "../../../lib/clipboard";
import { CONTENT_SYSTEM, buildContentPrompt, parseContentAngles, type ContentAngle } from "../../../lib/studio/content-angles";
import { strategyContext, type GoldenExample } from "../../../lib/studio/golden-example";
import { EMPTY_OFFER, type OfferData } from "../../../lib/studio/offer-coach";
import type { MessageInput } from "../../../lib/studio/message-copy";
import { loadBrandProfile, brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";

/** The six proven post shapes the model rotates through (see CONTENT_SYSTEM),
 *  spelled out so a founder recognises each idea's move — and can spin their own.
 *  Each carries a theme-aware accent drawn from the design-system tokens. */
const ANGLE_TYPES: { cls: string; name: string; tag: string; body: string }[] = [
  { cls: "a-contra", name: "Contrarian take", tag: "Challenge", body: "Push back on what everyone in your space repeats. Disagreement earns a second look." },
  { cls: "a-mist", name: "Common mistake", tag: "Warn", body: "Name the error quietly costing your customer — then point at the fix." },
  { cls: "a-ba", name: "Before / after", tag: "Proof", body: "Show the change you create: where they start, and where they land." },
  { cls: "a-myth", name: "Myth to bust", tag: "Clarify", body: "Correct a belief that keeps them stuck. Clarity feels like relief." },
  { cls: "a-how", name: "Quick how-to", tag: "Teach", body: "One small, usable step they can try today. Useful travels far." },
  { cls: "a-story", name: "Personal story", tag: "Connect", body: "A short, real moment. People follow people before they follow brands." },
];

export default function ContentPage() {
  const toast = useToast();
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [golden, setGolden] = useState<GoldenExample | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [angles, setAngles] = useState<ContentAngle[]>([]);
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
    } catch { /* grounding optional */ }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadBrandProfile().then(setBrand); void loadStrategyBrief().then(setStrategy); }, []);

  const grounded = !!(offer?.name?.trim() || offer?.promise?.trim() || msg?.oneLiner?.solution?.trim());

  const generate = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setBusy(true); setAngles([]);
    try {
      const bizBrand = hasBrand(brand) ? `BRAND:\n${brandBrief(brand)}` : "";
      const bizStrategy = strategy?.has ? `BUSINESS STRATEGY (make the content serve this goal and constraint):\n${strategy.brief}` : "";
      const combinedStrategy = [bizBrand, bizStrategy, strategyContext(golden)].filter(Boolean).join("\n\n");
      const reply = await callAI(conn, CONTENT_SYSTEM, buildContentPrompt(offer, msg, combinedStrategy), 900);
      const out = parseContentAngles(reply);
      if (out.length === 0) { toast("The model didn't return usable ideas — try again.", "error"); return; }
      setAngles(out);
    } catch (e) { toast(e instanceof Error ? e.message : "Generate failed — check your AI connection.", "error"); }
    finally { setBusy(false); }
  };

  const copy = async (i: number, a: ContentAngle) => {
    const text = a.idea ? `${a.hook}\n\n${a.idea}` : a.hook;
    if (await copyText(text)) { setCopied(i); window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 1600); toast("Copied — write the post from this angle."); }
    else toast("Couldn't copy — select the text manually.", "error");
  };

  return (
    <div className="ca-root">
      <style>{CSS}</style>
      <div className="hub-header">
        <div>
          <div className="eyebrow"><span className="eb-spark" aria-hidden>✦</span> PSYCHOLOGY · CONTENT ANGLES</div>
          <h1>Never wonder <span className="ca-grad">what to post</span></h1>
          <p className="sub">Outreach is <b>one-to-one</b>; content is <b>one-to-many</b>. Get scroll-stopping post ideas built on your offer — each a hook plus what to say — so the right people find you while you sleep.</p>
        </div>
        <a href="/psychology" className="btn ghost">← Psychology</a>
      </div>

      <AIStatus />

      <WorkedExample id="content" />

      {!grounded && (
        <div className="ca-note info" role="note">
          <span className="ca-note-ic" aria-hidden>◎</span>
          <p>These get sharper with your <a href="/business/message">Message</a> and <a href="/psychology/offer">Offer</a> written — they aim every idea at your exact customer.</p>
        </div>
      )}

      {golden && (
        <div className="ca-note strat" role="note">
          <span className="ca-note-ic" aria-hidden>✦</span>
          <p>On strategy: these ideas follow your <a href="/psychology/golden">Golden Example</a> — leading with your driving product and pointing to the profit on the back end.</p>
        </div>
      )}

      <section className="ca-angles" aria-labelledby="ca-angles-h">
        <div className="ca-angles-head">
          <div className="eyebrow eb2">The playbook</div>
          <h2 id="ca-angles-h">Six angles that stop the scroll</h2>
          <p className="ca-angles-sub">Every batch mixes these proven shapes, so your feed never reads like the same post twice. Learn them and you can spin your own, too.</p>
        </div>
        <div className="ca-angles-grid">
          {ANGLE_TYPES.map((t) => (
            <div className={`ca-atype ${t.cls}`} key={t.name}>
              <div className="ca-atype-top">
                <span className="ca-atype-name">{t.name}</span>
                <span className="ca-atype-tag">{t.tag}</span>
              </div>
              <p className="ca-atype-body">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="card ca-generate">
        <div className="ca-gen-copy">
          <div className="eyebrow eb3">Your turn</div>
          <p className="ca-lead">Fresh angles for posts, threads, reels or a newsletter — <b>six at a time</b>, grounded in what you sell.</p>
          <div style={{ marginTop: 8 }}><GroundingChips brand={hasBrand(brand)} strategy={!!strategy?.has} /></div>
        </div>
        <button className="btn primary big" disabled={busy} onClick={() => void generate()}>{busy ? "Thinking…" : angles.length ? "✦ More ideas" : "✦ Give me post ideas"}</button>
      </div>

      {busy && angles.length === 0 && (
        <div className="ca-loading" role="status">
          <span className="ca-dots" aria-hidden><i></i><i></i><i></i></span>
          <span>Reading your offer and message, then sketching six angles…</span>
        </div>
      )}

      {angles.length > 0 && (
        <section className="ca-results" aria-label="Generated post ideas">
          <div className="ca-results-head">
            <h2 className="ca-results-h">Your post ideas</h2>
            <span className="ca-count" aria-live="polite">{angles.length} ready · tap Copy to grab one</span>
          </div>
          <div className="ca-list" role="list">
            {angles.map((a, i) => (
              <div className="ca-card" role="listitem" key={i}>
                <span className="ca-num" aria-hidden>{i + 1}</span>
                <div className="ca-card-main">
                  <div className="ca-top">
                    <div className="ca-hook">{a.hook}</div>
                    <button className={`ca-copy${copied === i ? " is-copied" : ""}`} onClick={() => void copy(i, a)} aria-label={copied === i ? "Copied to clipboard" : `Copy idea ${i + 1}`}>{copied === i ? "Copied ✓" : "Copy"}</button>
                  </div>
                  {a.idea && <div className="ca-idea">{a.idea}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="ca-foot" role="note">
        <span className="ca-foot-tag">Tip</span>
        <p className="ca-foot-p">Post the hook as the first line — it&rsquo;s the only thing most people read before deciding to stop. Adapt every idea into your own voice.</p>
      </div>
    </div>
  );
}

const CSS = `
.ca-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-radius-lg:12px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .ca-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.ca-root *{box-sizing:border-box;}

/* Header — spark eyebrow, a quiet brand→info gradient on the promise phrase, and
   a back button that lifts on hover so it reads as interactive. */
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:26px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eb-spark{color:var(--ds-brand);font-size:12px;line-height:1;}
.ca-grad{background-image:linear-gradient(92deg,var(--ds-brand),var(--ds-info));color:var(--ds-brand);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.ca-grad{color:transparent;-webkit-background-clip:text;background-clip:text;}}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:66ch;line-height:1.55;}
.sub b{color:var(--text);font-weight:700;}
.ca-root .hub-header a.btn{transition:transform .15s var(--ds-ease,ease),background .15s,border-color .15s,color .15s,box-shadow .15s;}
.ca-root .hub-header a.btn:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));}

/* Helper notes — the two guidance bars now read as distinct, coloured cues: a
   blue "aim this sharper" note (◎ target) and a brand "on strategy" note. */
.ca-note{display:flex;align-items:flex-start;gap:10px;border:1px solid transparent;border-radius:var(--ds-radius-md,11px);padding:11px 14px;font-size:13px;line-height:1.5;color:var(--muted);margin-bottom:14px;}
.ca-note p{margin:0;}
.ca-note a{font-weight:600;text-decoration:underline;text-underline-offset:2px;transition:color .15s;}
.ca-note-ic{flex:0 0 auto;font-size:13px;line-height:1.5;font-weight:700;}
.ca-note.info{background:var(--ds-info-soft);border-color:color-mix(in srgb,var(--ds-info) 26%,transparent);}
.ca-note.info .ca-note-ic{color:var(--ds-info);}
.ca-note.info a{color:var(--ds-info);}
.ca-note.strat{background:var(--ds-brand-soft);border-color:color-mix(in srgb,var(--ds-brand) 26%,transparent);}
.ca-note.strat .ca-note-ic{color:var(--ds-brand);}
.ca-note.strat a{color:var(--ds-brand-hover);}

/* The playbook — teaches the six angle shapes the model rotates through so a
   founder can recognise (and reuse) each move. Informational cards, each with a
   theme-aware accent left-border and a soft tint; they lift gently on hover. */
.ca-angles{margin:2px 0 16px;}
.ca-angles-head{margin-bottom:11px;}
.eb2{color:var(--ds-text-tertiary);}
.ca-angles h2{font-size:16px;font-weight:700;letter-spacing:-.3px;margin:5px 0 4px;color:var(--text);}
.ca-angles-sub{font-size:13px;color:var(--muted);line-height:1.5;margin:0;max-width:64ch;}
.ca-angles-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;}
.ca-atype{--c:var(--ds-brand);background:color-mix(in srgb,var(--c) 5%,var(--ds-surface));border:1px solid var(--ds-border-subtle);border-left:3px solid var(--c);border-radius:var(--ds-radius-md,11px);padding:10px 12px;transition:transform .15s var(--ds-ease,ease),box-shadow .15s;}
.ca-atype:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));}
.ca-atype-top{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;}
.ca-atype-name{font-size:13px;font-weight:700;color:var(--c);letter-spacing:-.2px;}
.ca-atype-tag{flex:0 0 auto;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent);border-radius:99px;padding:2px 6px;}
.ca-atype-body{font-size:12px;color:var(--muted);line-height:1.45;margin:0;}
.a-contra{--c:var(--ds-warning);}
.a-mist{--c:var(--ds-danger);}
.a-ba{--c:var(--ds-success);}
.a-myth{--c:var(--ds-info);}
.a-how{--c:var(--ds-brand);}
.a-story{--c:var(--ds-info);}
@media (max-width:640px){.ca-angles-grid{grid-template-columns:1fr 1fr;}}
@media (max-width:420px){.ca-angles-grid{grid-template-columns:1fr;}}

/* Generate card — the action, warmed with a soft brand wash so the CTA reads as
   the moment to act. Button lifts on hover; disabled state stays calm. */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 18px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.ca-generate{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:linear-gradient(180deg,color-mix(in srgb,var(--ds-brand) 5%,var(--ds-surface)),var(--ds-surface));border-color:color-mix(in srgb,var(--ds-brand) 20%,var(--ds-border-default));}
.ca-gen-copy{flex:1;min-width:220px;}
.eb3{color:var(--ds-brand);margin-bottom:4px;}
.ca-lead{font-size:13.5px;color:var(--muted);line-height:1.55;margin:0;}
.ca-lead b{color:var(--text);font-weight:700;}
.ca-generate .btn.primary:not(:disabled):hover{transform:translateY(-1px);}

/* Friendly loading state — so the wait reads as work, not a hang. */
.ca-loading{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);line-height:1.5;background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-md,11px);padding:12px 14px;margin-bottom:14px;}
.ca-dots{display:inline-flex;gap:4px;flex:0 0 auto;}
.ca-dots i{width:6px;height:6px;border-radius:50%;background:var(--ds-brand);display:inline-block;animation:ca-bounce 1s infinite ease-in-out;}
.ca-dots i:nth-child(2){animation-delay:.15s;}
.ca-dots i:nth-child(3){animation-delay:.3s;}
@keyframes ca-bounce{0%,80%,100%{opacity:.3;transform:translateY(0);}40%{opacity:1;transform:translateY(-3px);}}

/* Results — numbered cards with a brand left-edge that intensifies on hover, and
   a copy button that turns success-green the moment it lands. */
.ca-results{margin-top:2px;}
.ca-results-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;}
.ca-results-h{font-size:16px;font-weight:700;letter-spacing:-.3px;margin:0;color:var(--text);}
.ca-count{font-size:12px;color:var(--ds-text-tertiary);font-weight:600;}
.ca-list{display:flex;flex-direction:column;gap:10px;}
.ca-card{display:flex;gap:12px;background:var(--surface);border:1px solid var(--border);border-left:3px solid color-mix(in srgb,var(--ds-brand) 45%,var(--border));border-radius:10px;padding:13px 15px;box-shadow:var(--ds-shadow-xs);transition:transform .15s var(--ds-ease,ease),box-shadow .15s,border-color .15s;}
.ca-card:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));border-left-color:var(--ds-brand);}
.ca-num{flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand);font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:1px;}
.ca-card-main{flex:1;min-width:0;}
.ca-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.ca-hook{flex:1;font-size:15px;font-weight:700;line-height:1.4;color:var(--text);}
.ca-copy{flex:0 0 auto;background:var(--ds-brand);color:#fff;border:none;border-radius:8px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s,transform .06s ease,box-shadow .15s;}
.ca-copy:hover{background:var(--ds-brand-hover);transform:translateY(-1px);box-shadow:0 2px 8px -2px color-mix(in srgb,var(--ds-brand) 50%,transparent);}
.ca-copy:active{transform:translateY(0.5px) scale(.99);}
.ca-copy.is-copied{background:var(--ds-success);}
.ca-copy:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.ca-idea{font-size:13px;color:var(--muted);line-height:1.5;margin-top:6px;}

/* Footer tip — a warm brand-tinted note instead of a stray line of small text. */
.ca-foot{display:flex;align-items:flex-start;gap:10px;margin:16px 2px 0;background:var(--ds-brand-soft);border:1px solid color-mix(in srgb,var(--ds-brand) 22%,transparent);border-radius:var(--ds-radius-md,11px);padding:10px 13px;}
.ca-foot-tag{flex:0 0 auto;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:var(--ds-brand-solid);border-radius:6px;padding:3px 8px;margin-top:1px;}
.ca-foot-p{font-size:12.5px;color:var(--ds-text-secondary);line-height:1.5;margin:0;}

@media (prefers-reduced-motion: reduce){.ca-root *{transition:none!important;animation:none!important;}}
`;
