"use client";
/**
 * Message — the first step of the Path. Clarity before spend: build a one-liner
 * (Problem → Solution → Result) a customer instantly gets, backed by a simple
 * story grid. The live preview composes as you type, so you can hear it. Saved
 * to the workspace_business blob (lib/message.ts); other surfaces (funnel intro,
 * ad creative, broadcasts) can pull the same one-liner so the product speaks
 * with one voice.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { useToast } from "../../../components/Toast";
import ExportPanel from "../../../components/ExportPanel";
import Explain from "../../../components/Explain";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";
import { messageAssets } from "../../../lib/studio/platform-export";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { extractJson } from "../../../lib/ai-browser";
import { copyText } from "../../../lib/clipboard";
import { MESSAGE_DRAFT_SYSTEM, buildMessageDraftPrompt } from "../../../lib/studio/message-copy";
import { loadStrategyBrief, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { RecentExperiments } from "../../../components/studio/RecentExperiments";
import type { OneLiner, MessageData } from "../../../lib/message";

const EMPTY: MessageData = { oneLiner: { problem: "", solution: "", result: "" }, character: "", wants: "", internalProblem: "", plan: "", success: "", failure: "" };

function compose(m: MessageData): string {
  const { problem, solution, result } = m.oneLiner;
  if (!problem.trim() || !solution.trim() || !result.trim()) return "";
  const p = problem.trim().replace(/[.]+$/, "");
  const s = solution.trim().replace(/[.]+$/, "");
  const r = result.trim().replace(/[.]+$/, "");
  return `${p}. ${s}, so ${r}.`;
}

// Lightweight clarity check — StoryBrand favours short, plain, customer-first
// copy. Heuristic only; it nudges, it doesn't gatekeep.
const JARGON = ["synergy", "leverage", "solutions", "world-class", "cutting-edge", "cutting edge", "innovative", "robust", "seamless", "revolutionary", "disrupt", "empower", "holistic", "next-gen", "paradigm", "best-in-class", "turnkey", "scalable", "ecosystem", "bandwidth", "value-add", "mission-critical"];
function clarity(text: string): { score: number; tips: string[] } {
  if (!text) return { score: 0, tips: [] };
  const tips: string[] = [];
  let score = 100;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words > 30) { score -= 25; tips.push(`It's ${words} words — aim under 30 so it sticks.`); }
  const found = JARGON.filter((j) => new RegExp(`\\b${j.replace(/[-\s]/g, "[-\\s]")}\\b`, "i").test(text));
  if (found.length) { score -= Math.min(30, found.length * 12); tips.push(`Swap jargon for plain words: ${found.slice(0, 3).join(", ")}.`); }
  if (!/\b(you|your)\b/i.test(text)) { score -= 15; tips.push("Make the customer the hero — speak to “you”."); }
  if (text.length < 30) { score -= 10; tips.push("A little more detail will help it land."); }
  return { score: Math.max(10, Math.min(100, score)), tips };
}

// The three parts of the one-liner, in order. Rendered as a tiny progress track
// above the fields — and colour-matched to each field's accent rail — so
// finishing a part shows up as visible progress: Problem → Solution → Result.
const PART_STEPS = [
  { k: "problem", n: 1, label: "Problem", cls: "pt-problem" },
  { k: "solution", n: 2, label: "Solution", cls: "pt-solution" },
  { k: "result", n: 3, label: "Result", cls: "pt-result" },
] as const;

export default function MessagePage() {
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [doc, setDoc] = useState<MessageData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [desc, setDesc] = useState(""); // one-line business description to draft from
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null); // Business-OS strategy grounds the draft
  useEffect(() => { void loadStrategyBrief().then(setStrategy); }, []);
  // True right after "Draft with AI" fills the message — content the user
  // hasn't reviewed or written a word of, even though the clarity score and
  // persuasion score update on it immediately. Cleared the moment they edit
  // any field (they've now looked at it) or save (they've accepted it).
  const [draftPending, setDraftPending] = useState(false);
  const toast = useToast();
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/business/message${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json();
      setDoc({ ...EMPTY, ...d, oneLiner: { ...EMPTY.oneLiner, ...(d.oneLiner ?? {}) } });
      setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  // True once the fetch below finds a saved Brand Brain — surfaced next to the
  // AI control (GroundingChips) so grounding the draft in it is never silent.
  const [hasBrandProfile, setHasBrandProfile] = useState(false);
  // Pre-fill the "describe your business" field from the saved Brand Brain, so
  // the AI draft is grounded in the real business and the owner doesn't re-type
  // what they already entered in Campaign Studio. Best-effort (no brand / no
  // entitlement just leaves it blank); only fills a blank field, never overwrites.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/campaign-studio/brand", { credentials: "include" });
        if (!r.ok || !live) return;
        const b = (await r.json()) as { companyName?: string; description?: string };
        const composed = [b.companyName?.trim(), b.description?.trim()].filter(Boolean).join(" — ");
        if (composed) { setHasBrandProfile(true); setDesc((cur) => (cur.trim() ? cur : composed)); }
      } catch { /* no brand / no entitlement — leave blank */ }
    })();
    return () => { live = false; };
  }, []);

  const oneLiner = useMemo(() => compose(doc), [doc]);
  const check = useMemo(() => clarity(oneLiner), [oneLiner]);
  // Copy-ready blocks for pasting the message into the user's own platform.
  const exportAssets = useMemo(
    () => messageAssets({ oneLiner, wants: doc.wants, success: doc.success, plan: doc.plan }),
    [oneLiner, doc.wants, doc.success, doc.plan],
  );
  const [copied, setCopied] = useState(false);
  const copyOneLiner = () => {
    if (!oneLiner) return;
    void copyText(oneLiner).then((ok) => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1600); } });
  };
  const setOne = (k: keyof OneLiner, v: string) => { setSaved(false); setDraftPending(false); setDoc((d) => ({ ...d, oneLiner: { ...d.oneLiner, [k]: v } })); };
  const setField = (k: keyof MessageData, v: string) => { setSaved(false); setDraftPending(false); setDoc((d) => ({ ...d, [k]: v })); };

  // Draft the WHOLE message with the user's own connected AI (BYO key,
  // client-side — same path as Creative Studio): the story grid AND the
  // one-liner, from a one-line description plus whatever's already filled in.
  const draftWithAI = useCallback(async () => {
    const conn = loadConnection();
    if (!conn) { setAiErr("Connect an AI provider in Campaign Studio → Connections to draft with AI."); return; }
    setAiBusy(true); setAiErr("");
    try {
      const reply = await callAI(conn, MESSAGE_DRAFT_SYSTEM, buildMessageDraftPrompt(desc, doc, strategy?.has ? strategy.brief : ""), 700);
      type Full = Partial<Omit<MessageData, "oneLiner" | "updatedAt">> & { oneLiner?: Partial<OneLiner> };
      // Pull the JSON out of the model's reply via the shared extractJson helper,
      // guarded so a reply that isn't clean JSON shows the one friendly message
      // below — never a raw "Unexpected token…" from JSON.parse reaching the user.
      const parsed: Full | null = (() => { try { return extractJson(reply) as Full; } catch { return null; } })();
      const ol = parsed?.oneLiner ?? {};
      if (parsed && (ol.problem || ol.solution || ol.result || parsed.character)) {
        setSaved(false);
        setDraftPending(true);
        setDoc((d) => ({
          ...d,
          character: (parsed.character ?? d.character).slice(0, 300),
          wants: (parsed.wants ?? d.wants).slice(0, 300),
          internalProblem: (parsed.internalProblem ?? d.internalProblem).slice(0, 400),
          plan: (parsed.plan ?? d.plan).slice(0, 600),
          success: (parsed.success ?? d.success).slice(0, 400),
          failure: (parsed.failure ?? d.failure).slice(0, 400),
          oneLiner: {
            problem: (ol.problem ?? d.oneLiner.problem).slice(0, 400),
            solution: (ol.solution ?? d.oneLiner.solution).slice(0, 400),
            result: (ol.result ?? d.oneLiner.result).slice(0, 400),
          },
        }));
      } else { setAiErr("The model didn't return a usable message — try again."); }
    } catch (e) { setAiErr(e instanceof Error ? e.message : "Draft failed — check your AI connection."); }
    finally { setAiBusy(false); }
  }, [doc, desc, strategy]);

  const save = useCallback(async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/message${wsQuery}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr((d as { error?: string }).error || "Could not save."); setSaving(false); return; }
      setSaved(true); setSaving(false);
      // Saving is an explicit "I've reviewed this" action — clear the banner.
      setDraftPending(false);
      toast("Message saved — your funnel intro & creative can pull this now.");
    } catch { setErr("Network error — please try again."); setSaving(false); }
  }, [doc, toast, wsQuery]);

  if (state === "loading") return <Shell><div className="card sk" /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" href="/" cta="Go to sign in" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Couldn&rsquo;t load your message" onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Message · Step 1</div>
          <h1>Say it so they buy</h1>
          <p className="sub">A customer buys when they instantly understand what you do and why it matters. Build a one-liner — <b>Problem → Solution → Result</b> — and the rest of the funnel can speak with the same clear voice.</p>
        </div>
        <a href="/business" className="btn ghost">← Business OS</a>
      </div>

      <RecentExperiments />

      <WorkedExample id="message" onUse={(ex) => {
        const p = ex.prefill as Partial<MessageData> | undefined;
        if (!p) return;
        setSaved(false);
        setDoc((d) => ({ ...d, ...p, oneLiner: { ...d.oneLiner, ...((p.oneLiner as OneLiner | undefined) ?? {}) } }));
      }} />

      {/* Live one-liner */}
      <div className="oneliner">
        <div className="ol-head">
          <div className="ol-tag">Your one-liner</div>
          {oneLiner && <button className="ol-copy" onClick={copyOneLiner}>{copied ? "Copied ✓" : "Copy"}</button>}
        </div>
        {oneLiner
          ? <p className="ol-text">“{oneLiner}”</p>
          : <p className="ol-text muted">Fill in the three parts below and your one-liner composes itself here.</p>}
        {oneLiner && <p className="ol-say">Read it aloud — if it sounds like something you&rsquo;d actually say, it&rsquo;s working.</p>}
        {oneLiner && (
          <div className="ol-clarity">
            <div className="olc-bar"><span style={{ width: `${check.score}%` }} /></div>
            <div className="olc-label">Clarity {check.score}/100</div>
            {check.tips.length === 0
              ? <div className="olc-tip good"><MarketingIcon name="check" size={13} /> Crisp and clear</div>
              : check.tips.map((t, i) => <div className="olc-tip" key={i}>{t}</div>)}
          </div>
        )}
      </div>

      <AIStatus />

      {/* AI first-draft */}
      <div className="card aidraft">
        <div className="card-h"><MarketingIcon name="spark" size={15} /> Let AI write your first draft <span className="hint">Optional — describe your business, we fill everything</span></div>
        <p className="card-why">Give one plain sentence about what you do and AI fills in a starting draft for every field below — then you make it sound like you.</p>
        <div className="aidraft-grounding"><GroundingChips brand={hasBrandProfile} strategy={!!strategy?.has} /></div>
        <div className="aidraft-row">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. We help first-time founders run profitable Facebook ads" />
          <button className="btn primary" disabled={aiBusy} onClick={() => void draftWithAI()}>{aiBusy ? "Drafting…" : "Draft with AI"}</button>
        </div>
        {aiErr && <div className="ai-err" role="alert">{aiErr}</div>}
      </div>

      {draftPending && (
        <div className="draft-pending"><b>AI draft</b> Not yet reviewed — read it over and put it in your own words, then save.</div>
      )}

      {/* The three parts */}
      <div className="card">
        <div className="card-h">The one-liner <Explain term="One-liner" /> <span className="hint">Three short parts — plain words, no jargon</span></div>
        <p className="card-why">This is the sentence people remember. Say each part the way you&rsquo;d say it to a friend, and every ad, email and page can reuse it.</p>
        <div className="parts-track" aria-label="One-liner progress">
          {PART_STEPS.map((s) => {
            const done = doc.oneLiner[s.k].trim().length > 0;
            return (
              <span key={s.k} className={`pt-step ${s.cls}${done ? " done" : ""}`}>
                <i className="pt-badge" aria-hidden="true">{done ? "✓" : s.n}</i>{s.label}
              </span>
            );
          })}
        </div>
        <label className="fld fld--problem"><span><b className="pnum">1</b> The problem <em>the pain your customer is in</em></span>
          <textarea rows={2} value={doc.oneLiner.problem} onChange={(e) => setOne("problem", e.target.value)} placeholder="Most founders spend on ads before they know the funnel makes money" />
        </label>
        <label className="fld fld--solution"><span><b className="pnum">2</b> The solution <em>what you offer</em></span>
          <textarea rows={2} value={doc.oneLiner.solution} onChange={(e) => setOne("solution", e.target.value)} placeholder="OneVYRT maps and simulates the whole funnel first" />
        </label>
        <label className="fld fld--result"><span><b className="pnum">3</b> The result <em>the outcome they get</em></span>
          <textarea rows={2} value={doc.oneLiner.result} onChange={(e) => setOne("result", e.target.value)} placeholder="you know exactly what to fix before you spend a dollar" />
        </label>
      </div>

      {/* Story grid */}
      <div className="card">
        <div className="card-h">The story behind it <span className="hint">Optional — sharpens the one-liner and every asset after it</span></div>
        <p className="card-why">You don&rsquo;t have to fill these in &mdash; but naming the hero, the stakes and the win gives your one-liner (and the AI draft) something real to sharpen against.</p>
        <div className="grid2">
          <label className="fld"><span>Your customer <em>who is the hero</em></span>
            <input value={doc.character} onChange={(e) => setField("character", e.target.value)} placeholder="Founders running their first paid ads" />
          </label>
          <label className="fld"><span>What they want</span>
            <input value={doc.wants} onChange={(e) => setField("wants", e.target.value)} placeholder="Predictable customers without wasting ad spend" />
          </label>
          <label className="fld"><span>How the problem feels <em>the internal cost</em></span>
            <input value={doc.internalProblem} onChange={(e) => setField("internalProblem", e.target.value)} placeholder="Anxious that every pound is a guess" />
          </label>
          <label className="fld"><span>Your plan <em>the simple steps</em></span>
            <input value={doc.plan} onChange={(e) => setField("plan", e.target.value)} placeholder="Map → simulate → fix → launch" />
          </label>
          <label className="fld"><span>Success <em>what winning looks like</em></span>
            <input value={doc.success} onChange={(e) => setField("success", e.target.value)} placeholder="A funnel that prints profit on demand" />
          </label>
          <label className="fld"><span>Failure <em>the stakes they avoid</em></span>
            <input value={doc.failure} onChange={(e) => setField("failure", e.target.value)} placeholder="Burning the budget on a funnel that leaks" />
          </label>
        </div>
      </div>

      {/* Put it in your platform */}
      {exportAssets.length > 0 && (
        <ExportPanel
          assets={exportAssets}
          title="Use your message in your platform"
          subtitle="You wrote it here — copy each block and drop it into WordPress, GoHighLevel, Shopify, ActiveCampaign or your email tool."
        />
      )}

      {/* Save bar */}
      <div className="savebar">
        {err && <div className="err" role="alert">{err}</div>}
        {saved && !err && <div className="ok">Saved — your funnel intro & creative can pull this now.</div>}
        <div className="savebar-btns">
          <a className="btn" href="/business/funnels">Use it in a funnel →</a>
          <button className="btn primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save message"}</button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="hub-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.hub-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:26px;font-weight:700;margin:2px 0 6px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;line-height:1.5;}
.sub b{color:var(--text);font-weight:700;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px;box-shadow:var(--ds-shadow-xs);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.lock{font-size:34px;}

.oneliner{background:linear-gradient(135deg,var(--ds-brand),#0bb87f);color:#fff;border-radius:var(--ds-radius-xl);padding:22px 24px;box-shadow:0 12px 30px -10px rgba(10,158,110,.45);margin-bottom:22px;}
.ol-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;}
.ol-tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;opacity:.85;}
.ol-copy{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s;}
.ol-copy:hover{background:rgba(255,255,255,.28);transform:translateY(-1px);box-shadow:0 4px 10px -4px rgba(0,0,0,.35);}
.ol-copy:active{transform:translateY(0);}
.ol-copy:focus-visible{outline:2px solid #fff;outline-offset:2px;}
.ol-say{margin:11px 0 0;font-size:12.5px;line-height:1.5;opacity:.9;display:flex;align-items:center;gap:7px;}
.ol-say::before{content:"🗣";font-size:13px;flex:0 0 auto;}
.ol-text{font-size:20px;font-weight:500;line-height:1.4;margin:0;letter-spacing:-.2px;}
.ol-text.muted{opacity:.8;font-weight:500;font-size:16px;}
.ol-clarity{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.22);}
.olc-bar{height:6px;background:rgba(255,255,255,.22);border-radius:99px;overflow:hidden;margin-bottom:7px;}
.olc-bar span{display:block;height:100%;background:#fff;border-radius:99px;transition:width .4s ease;}
.olc-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.9;margin-bottom:6px;}
.olc-tip{font-size:12.5px;opacity:.95;line-height:1.5;display:flex;align-items:center;gap:6px;}
.olc-tip.good{font-weight:700;}

.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 16px 18px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;transition:box-shadow .15s ease,border-color .15s ease;}
.card:focus-within{border-color:var(--border-strong);box-shadow:var(--ds-shadow-sm);}
.card.sk{height:200px;}
.card-h{font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.aidraft{background:linear-gradient(180deg,var(--ds-brand-soft),var(--surface) 62%);}
.aidraft .card-h svg{color:var(--ds-brand);}
.aidraft-grounding{margin:-2px 0 12px;}
.aidraft-row{display:flex;gap:8px;align-items:stretch;}
.aidraft-row input{flex:1;font-family:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:9px;padding:9px 11px;transition:border-color .15s ease,box-shadow .15s ease;}
.aidraft-row input:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.aidraft-row .btn{white-space:nowrap;}
.ai-err{font-size:12px;color:var(--ds-danger);font-weight:500;margin-top:10px;}
.hint{font-size:11.5px;font-weight:500;color:var(--ds-text-tertiary);}
/* Informational — this is real content sitting in the form, not yet reviewed;
   it's not a problem, so it stays blue, not amber/red. */
.draft-pending{display:flex;align-items:center;gap:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.5;margin:-2px 0 14px;}
.draft-pending b{flex:0 0 auto;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:#1d4ed8;color:#fff;border-radius:6px;padding:2px 7px;}
:root[data-theme="dark"] .draft-pending{background:#0f1d3a;border-color:#1e3a6e;color:#bfdbfe;}
.fld{display:flex;flex-direction:column;gap:5px;margin-bottom:11px;font-size:12.5px;font-weight:500;color:var(--muted);}
.fld em{font-weight:500;color:var(--ds-text-tertiary);font-style:normal;}
.fld input,.fld textarea{font-family:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:9px;padding:9px 11px;width:100%;resize:vertical;line-height:1.5;transition:border-color .15s ease,box-shadow .15s ease;}
.fld input:focus,.fld textarea:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.fld:focus-within>span{color:var(--text);}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;}
@media(max-width:560px){.grid2{grid-template-columns:1fr;}}

.savebar{position:sticky;bottom:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 14px;box-shadow:0 -4px 16px -6px rgba(15,23,42,.12);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px;}
.savebar .err{color:var(--ds-danger);font-size:12.5px;font-weight:500;}
.savebar .ok{color:var(--ds-success);font-size:12.5px;font-weight:500;}
.savebar-btns{display:flex;gap:8px;margin-left:auto;}

/* ---- Plain-language "why it matters" line under a section title ---- */
.card-why{font-size:12.5px;line-height:1.55;color:var(--muted);margin:-4px 0 14px;max-width:66ch;}
.card-why b{color:var(--text);font-weight:600;}

/* ---- Progress track above the three parts: each step lights up in its own
        semantic colour (amber problem, green solution, blue result) as you
        fill it, mirroring the accent rails on the fields below. ---- */
.parts-track{display:flex;align-items:center;flex-wrap:wrap;gap:2px 4px;margin:2px 0 15px;padding:9px 11px;background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:11px;}
.pt-step{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ds-text-tertiary);transition:color .15s ease;}
.pt-step.done{color:var(--text);}
.pt-badge{width:19px;height:19px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-style:normal;background:var(--surface);border:1px solid var(--border-strong);color:var(--ds-text-tertiary);transition:background .15s ease,color .15s ease,border-color .15s ease;}
.pt-step.done .pt-badge{border-color:transparent;}
.pt-problem.done .pt-badge{background:var(--ds-warning-soft);color:var(--ds-warning);}
.pt-solution.done .pt-badge{background:var(--ds-brand-soft);color:var(--ds-brand-active);}
.pt-result.done .pt-badge{background:var(--ds-info-soft);color:var(--ds-info);}
.pt-step + .pt-step::before{content:"→";margin:0 5px 0 1px;color:var(--ds-text-disabled);font-weight:400;}

/* ---- Colour-coded accent rails + number badges on the three parts ---- */
.fld--problem,.fld--solution,.fld--result{padding-left:13px;border-left:3px solid var(--border-strong);border-radius:2px;transition:border-color .15s ease;}
.fld--problem{border-left-color:var(--ds-warning);}
.fld--solution{border-left-color:var(--ds-brand);}
.fld--result{border-left-color:var(--ds-info);}
.pnum{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:6px;font-size:11px;font-weight:700;margin-right:3px;vertical-align:-4px;}
.fld--problem .pnum{background:var(--ds-warning-soft);color:var(--ds-warning);}
.fld--solution .pnum{background:var(--ds-brand-soft);color:var(--ds-brand-active);}
.fld--result .pnum{background:var(--ds-info-soft);color:var(--ds-info);}

/* ---- Honour reduced-motion: no transitions or animation ---- */
@media (prefers-reduced-motion: reduce){ .hub-root *{ transition:none!important; animation:none!important; } }
`;
