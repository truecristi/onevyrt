"use client";
/**
 * Execution OS Phase 2 — Launch OS. Prepare a launch until it's genuinely ready:
 * a weighted readiness checklist gated by hard blockers (GO/NO-GO), a preflight
 * of just the must-haves, and a decision log. Styled with the shared
 * design-system tokens, so it follows the user's light/dark theme like the
 * rest of the app.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { callOpenRouter, extractJson, getAiKey, getAiModel, getAiProvider, setAiKey as persistKey, setAiModel as persistModel } from "../../../lib/ai-browser";
import { loadGrounding, withGrounding, type Grounding } from "../../../lib/ai-grounding";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { confirmDialog } from "../../../components/Modal";
import { EmptyState } from "../../../components/ui/EmptyState";

type LaunchStatus = "planning" | "preflight" | "live" | "post";
interface ReadinessItem { id: string; category: string; label: string; weight: number; done: boolean; hardBlocker: boolean; }
interface Decision { id: string; at: string; decision: string; rationale: string; }
interface Launch { id: string; name: string; goal: string; date: string; status: LaunchStatus; readiness: ReadinessItem[]; decisions: Decision[]; notes: string; }
interface LaunchesData { launches: Launch[]; updatedAt?: string; }

// Status hues reference theme-aware design-system tokens (not raw hex) so a
// stage pill stays legible — and keeps its meaning (amber = needs attention,
// green = live, blue = informational) — in both the light and navy dark theme.
const STATUS_META: Record<LaunchStatus, { label: string; hue: string; soft: string }> = {
  planning: { label: "Planning", hue: "var(--ds-text-tertiary)", soft: "var(--ds-bg-subtle)" },
  preflight: { label: "Preflight", hue: "var(--ds-warning)", soft: "var(--ds-warning-soft)" },
  live: { label: "Live", hue: "var(--ds-success)", soft: "var(--ds-success-soft)" },
  post: { label: "Post-launch", hue: "var(--ds-info)", soft: "var(--ds-info-soft)" },
};
const STATUS_ORDER: LaunchStatus[] = ["planning", "preflight", "live", "post"];

const DEFAULT_READINESS: Omit<ReadinessItem, "id">[] = [
  { category: "Offer", label: "Offer, price and guarantee are finalised", weight: 5, done: false, hardBlocker: true },
  { category: "Offer", label: "Bonuses / deadline / scarcity defined", weight: 2, done: false, hardBlocker: false },
  { category: "Assets", label: "Sales page live and proofread", weight: 5, done: false, hardBlocker: true },
  { category: "Assets", label: "Emails written and scheduled", weight: 3, done: false, hardBlocker: false },
  { category: "Assets", label: "Ads / creative approved", weight: 3, done: false, hardBlocker: false },
  { category: "Tech", label: "Checkout tested with a real transaction", weight: 5, done: false, hardBlocker: true },
  { category: "Tech", label: "Tracking / analytics firing", weight: 3, done: false, hardBlocker: false },
  { category: "Tech", label: "Fulfilment / delivery ready", weight: 4, done: false, hardBlocker: true },
  { category: "Traffic", label: "Traffic source(s) ready and funded", weight: 4, done: false, hardBlocker: false },
  { category: "Traffic", label: "Audience warmed / list notified", weight: 2, done: false, hardBlocker: false },
  { category: "Team", label: "Support cover and response plan in place", weight: 3, done: false, hardBlocker: false },
  { category: "Team", label: "Roles for launch day assigned", weight: 2, done: false, hardBlocker: false },
];

function uid(): string { return (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36); }
function readinessOf(items: ReadinessItem[]): { pct: number; go: boolean; blockers: ReadinessItem[] } {
  let dw = 0, tw = 0; const blockers: ReadinessItem[] = [];
  for (const it of items) { const w = it.weight || 1; tw += w; if (it.done) dw += w; if (it.hardBlocker && !it.done) blockers.push(it); }
  return { pct: tw === 0 ? 0 : Math.round((dw / tw) * 100), go: items.length > 0 && blockers.length === 0, blockers };
}

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "error";

export default function LaunchesPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<LaunchesData>({ launches: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiKey, setAiKeyState] = useState("");
  const [aiModel, setAiModelState] = useState("openai/gpt-4o-mini");
  const latest = useRef(data); latest.current = data;
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
    setState("loading"); setErr("");
    try {
      const r = await fetch(`/api/business/launches${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as LaunchesData;
      setData({ launches: d.launches ?? [], updatedAt: d.updatedAt }); setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => { setAiKeyState(getAiKey()); setAiModelState(getAiModel()); }, []);
  const saveKey = (k: string) => { setAiKeyState(k); persistKey(k); };
  const saveModel = (m: string) => { setAiModelState(m); persistModel(m); };

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2500); };
  const mutate = (fn: (d: LaunchesData) => LaunchesData) => { setData((p) => fn(p)); setDirty(true); };

  const save = useCallback(async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/launches${wsQuery}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(latest.current) });
      const b = await r.json() as LaunchesData & { error?: string };
      if (!r.ok) { setErr(b.error ?? "Could not save."); return; }
      setData({ launches: b.launches ?? [], updatedAt: b.updatedAt });
      setDirty(false); flash("Saved.");
    } catch { setErr("Could not save."); }
    finally { setSaving(false); }
  }, [wsQuery]);

  const createLaunch = () => {
    const l: Launch = { id: uid(), name: "New launch", goal: "", date: "", status: "planning", readiness: DEFAULT_READINESS.map((r) => ({ ...r, id: uid() })), decisions: [], notes: "" };
    mutate((d) => ({ ...d, launches: [l, ...d.launches] })); setEditingId(l.id);
  };
  const removeLaunch = (id: string) => { mutate((d) => ({ ...d, launches: d.launches.filter((l) => l.id !== id) })); if (editingId === id) setEditingId(null); };
  const patchLaunch = (id: string, patch: Partial<Launch>) => mutate((d) => ({ ...d, launches: d.launches.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const editing = useMemo(() => data.launches.find((l) => l.id === editingId) ?? null, [data.launches, editingId]);

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Loading launches…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to use the Launch OS." href="/" cta="Go to sign in" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your launches." onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="lc-header">
        <div>
          <div className="eyebrow">Execution OS · Launch</div>
          <h1>{editing ? "Launch command" : "Launch OS"}</h1>
          <p className="sub">{editing ? "Get it genuinely ready — then go." : "Prepare each launch until readiness says GO. Hard blockers gate the launch; the weighted score tells you how close you are."}</p>
        </div>
        <div className="header-right">
          <button className="btn ghost sm" onClick={() => setAiOpen((v) => !v)} title="AI settings" aria-expanded={aiOpen} aria-controls="lc-ai-panel"><MarketingIcon name="gear" size={14} /> AI</button>
          {editing
            ? <button className="btn" onClick={() => setEditingId(null)}>← All launches</button>
            : <><a href="/business/execution" className="btn ghost sm"><MarketingIcon name="bolt" size={14} /> Execution</a><a href="/business/review" className="btn ghost sm"><MarketingIcon name="refresh" size={14} /> Review</a><a href="/business" className="btn ghost sm"><MarketingIcon name="compass" size={14} /> Overview</a><a href="/" className="btn ghost sm"><MarketingIcon name="home" size={14} /> Home</a><button className="btn primary" onClick={createLaunch}>+ New launch</button></>}
        </div>
      </div>

      {aiOpen && (
        <div className="panel" id="lc-ai-panel">
          <div className="cols">
            <AiConnectFields onChange={(c) => { saveKey(c.apiKey); saveModel(c.model); }} />
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Your key is saved to your account (encrypted) and sent straight to the AI provider. Used across the whole app&apos;s AI.</p>
        </div>
      )}
      {msg && <div className="msg ok" role="status" aria-live="polite">{msg}</div>}
      {err && <div className="msg err" role="alert">{err}</div>}

      {editing
        ? <LaunchEditor launch={editing} aiKey={aiKey} aiModel={aiModel} onNeedKey={() => { setAiOpen(true); setErr("Add your AI key first (the AI button)."); }} onPatch={(p) => patchLaunch(editing.id, p)} onDelete={() => removeLaunch(editing.id)} />
        : <LaunchList launches={data.launches} onOpen={setEditingId} onNew={createLaunch} onDelete={removeLaunch} />}

      {(editing || data.launches.length > 0) && (
        <div className="step-bar">
          <div className="step-count">{dirty ? "Unsaved changes" : data.updatedAt ? "All changes saved" : "Nothing saved yet"}</div>
          <div className="step-actions"><button className="btn primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Saving…" : "Save"}</button></div>
        </div>
      )}
    </Shell>
  );
}

function LaunchList({ launches, onOpen, onNew, onDelete }: { launches: Launch[]; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void }) {
  if (launches.length === 0) {
    return <EmptyState icon="rocket" title="No launches yet"
      description="Start a launch, tick off what's ready, and watch the weighted score climb until it says GO."
      action={<button className="btn primary" onClick={onNew}>+ New launch</button>} />;
  }
  // Portfolio-level context so a list of cards reads as organised momentum,
  // not just a pile of launches — computed fresh from props, no extra state.
  const ready = launches.filter((l) => readinessOf(l.readiness).go).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const next = launches.filter((l) => l.date && l.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <>
      <div className="momentum" role="group" aria-label="Launch portfolio at a glance">
        <div className="mstat">
          <span className="mnum grad">{launches.length}</span>
          <span className="mlabel">{launches.length === 1 ? "launch" : "launches"} tracked</span>
        </div>
        <div className="mstat">
          <span className="mnum" style={{ color: ready > 0 ? "var(--ds-success)" : undefined }}>{ready}</span>
          <span className="mlabel">ready to GO</span>
        </div>
        {next && (
          <div className="mstat next">
            <span className="mnum-sm">{next.date}</span>
            <span className="mlabel">next up — {next.name || "Untitled launch"}</span>
          </div>
        )}
      </div>
      <div className="grid">
        {launches.map((l) => {
          const r = readinessOf(l.readiness); const st = STATUS_META[l.status];
          return (
            <div key={l.id} className="lcard" role="button" tabIndex={0}
              aria-label={`Open ${l.name || "launch"} — ${st.label}, ${r.pct}% ready, ${r.go ? "GO" : "NO-GO"}`}
              onClick={() => onOpen(l.id)}
              onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l.id); } }}>
              <div className="lcard-top">
                <span className="pill" style={{ color: st.hue, background: st.soft }}>{st.label}</span>
                <button className="rep-del sm" title="Delete launch" aria-label={`Delete ${l.name || "launch"}`} onClick={async (e) => { e.stopPropagation(); if (await confirmDialog({ title: `Delete "${l.name}"?`, danger: true, confirmLabel: "Delete" })) onDelete(l.id); }}>×</button>
              </div>
              <h3 className="lcard-name">{l.name}</h3>
              {l.date && <div className="lcard-date"><MarketingIcon name="calendar" size={12} /> {l.date}</div>}
              <div className="lcard-foot">
                <div className="mini-gauge"><div className="mini-bar"><span style={{ width: `${r.pct}%` }} /></div><span>{r.pct}%</span></div>
                <span className={`go ${r.go ? "yes" : "no"}`}>{r.go ? "GO" : "NO-GO"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function LaunchEditor({ launch, aiKey, aiModel, onNeedKey, onPatch, onDelete }: { launch: Launch; aiKey: string; aiModel: string; onNeedKey: () => void; onPatch: (p: Partial<Launch>) => void; onDelete: () => void }) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  // What the "AI suggest items" button will actually ground on — loaded once
  // on mount so GroundingChips can make that visible next to the button,
  // instead of the grounding staying invisible the way aiSuggest's own fresh
  // loadGrounding() call below is.
  const [g, setG] = useState<Grounding | null>(null);
  useEffect(() => { void loadGrounding().then(setG); }, []);
  const r = useMemo(() => readinessOf(launch.readiness), [launch.readiness]);
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const it of launch.readiness) if (!seen.includes(it.category)) seen.push(it.category);
    return seen;
  }, [launch.readiness]);

  const setItems = (readiness: ReadinessItem[]) => onPatch({ readiness });
  const updateItem = (id: string, patch: Partial<ReadinessItem>) => setItems(launch.readiness.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems(launch.readiness.filter((it) => it.id !== id));
  const addItem = (category: string) => setItems([...launch.readiness, { id: uid(), category, label: "", weight: 3, done: false, hardBlocker: false }]);

  // AI: suggest readiness items specific to this launch, merged with what's
  // already there (dedup by label).
  const aiSuggest = async () => {
    if (getAiProvider() === "manual") { onNeedKey(); return; }
    setAiBusy(true); setAiErr("");
    try {
      const existing = launch.readiness.map((it) => it.label).filter(Boolean);
      const system = "You prepare launches. Suggest readiness checklist items specific to this launch, across categories like Offer, Assets, Tech, Traffic, Team. Return ONLY JSON: { items: [{ category, label, weight (1-5), hardBlocker (bool) }] } with 4-8 items. hardBlocker = can't launch without it. Don't repeat items already present.";
      const user = `Launch: ${launch.name || "(unnamed)"}\nGoal: ${launch.goal || "(none)"}\nAlready listed: ${existing.join("; ") || "(none)"}\nSuggest the items now.`;
      const g = await loadGrounding();
      const reply = await callOpenRouter(aiKey, aiModel, system, withGrounding(g, user), 500);
      const j = extractJson(reply) as { items?: { category?: string; label?: string; weight?: number; hardBlocker?: boolean }[] };
      if (Array.isArray(j.items) && j.items.length) {
        const seen = new Set(existing.map((s) => s.toLowerCase().trim()));
        const add: ReadinessItem[] = [];
        for (const it of j.items.slice(0, 12)) {
          const label = String(it.label ?? "").trim();
          if (!label || seen.has(label.toLowerCase())) continue;
          seen.add(label.toLowerCase());
          add.push({ id: uid(), category: String(it.category ?? "General"), label, weight: Math.max(1, Math.min(5, Math.round(Number(it.weight) || 3))), done: false, hardBlocker: it.hardBlocker === true });
        }
        if (add.length) setItems([...launch.readiness, ...add]);
        else setAiErr("No new items to add.");
      } else setAiErr("The AI didn't return items — try again.");
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI request failed."); }
    finally { setAiBusy(false); }
  };

  const setDecisions = (decisions: Decision[]) => onPatch({ decisions });
  const addDecision = () => setDecisions([{ id: uid(), at: "", decision: "", rationale: "" }, ...launch.decisions]);
  const updateDecision = (id: string, patch: Partial<Decision>) => setDecisions(launch.decisions.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const removeDecision = (id: string) => setDecisions(launch.decisions.filter((d) => d.id !== id));

  return (
    <>
      <div className="panel">
        <div className="cols">
          <label className="mini"><span>Launch name</span><input value={launch.name} onChange={(e) => onPatch({ name: e.target.value })} /></label>
          <label className="mini"><span>Status</span>
            <select value={launch.status} onChange={(e) => onPatch({ status: e.target.value as LaunchStatus })}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </label>
          <label className="mini"><span>Launch date</span><input type="date" value={launch.date} onChange={(e) => onPatch({ date: e.target.value })} /></label>
        </div>
        <p className="hint" style={{ margin: "6px 2px 12px" }}>Move it forward as you go — Planning → Preflight → Live → Post-launch.</p>
        <label className="mini"><span>Goal — what does a successful launch look like?</span>
          <textarea className="ta" value={launch.goal} onChange={(e) => onPatch({ goal: e.target.value })} placeholder="e.g. 50 sales / $25k in the 5-day window." />
        </label>
      </div>

      {/* Verdict */}
      <div className={`verdict ${r.go ? "go" : "nogo"}`} role="status" aria-live="polite">
        <div className="verdict-left">
          <div className="verdict-badge"><MarketingIcon name={r.go ? "check" : "warning"} size={12} /> {r.go ? "Ready" : "Not ready"}</div>
          <div className="verdict-go">{r.go ? "GO" : "NO-GO"}</div>
        </div>
        <div className="verdict-gauge">
          <div className="gauge-bar"><span style={{ width: `${r.pct}%` }} /></div>
          <div className="gauge-lbl">{r.pct}% weighted readiness</div>
        </div>
        {!r.go && r.blockers.length > 0 && (
          <div className="verdict-blockers">
            <span className="vb-title">Hard blockers left:</span>
            <ul>{r.blockers.map((b) => <li key={b.id}>{b.label || "(unnamed)"}</li>)}</ul>
          </div>
        )}
      </div>
      <p className="verdict-hint">Every tick below flows straight into this verdict — clear each ⚑ hard blocker to flip it to GO.</p>

      {/* Readiness by category */}
      <div className="sec-head">
        <div><h2 className="sec-title">Readiness</h2><p className="hint">Tick what's done. Weight (W1–W5) sets how much each item counts toward the score below; ⚑ marks a hard blocker — the launch stays NO-GO until every blocker is done.</p></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button className="btn sm" style={{ color: "var(--ds-brand)", borderColor: "var(--ds-brand)" }} onClick={() => void aiSuggest()} disabled={aiBusy} title="Ask AI to suggest readiness items based on this launch's name and goal">{aiBusy ? "Suggesting…" : <><MarketingIcon name="spark" size={13} /> AI suggest items</>}</button>
          <GroundingChips brand={g?.brand ?? false} strategy={g?.strategy ?? false} />
        </div>
      </div>
      {aiErr && <div className="msg err" role="alert">{aiErr}</div>}
      {categories.map((cat) => (
        <div key={cat} className="rcat">
          <div className="rcat-head"><span className="rcat-name">{cat}</span><button className="btn ghost sm" onClick={() => addItem(cat)} aria-label={`Add item to ${cat}`}>+ Item</button></div>
          {launch.readiness.filter((it) => it.category === cat).map((it) => (
            <div key={it.id} className={`ritem ${it.done ? "done" : ""}`}>
              <button className={`check ${it.done ? "on" : ""}`} onClick={() => updateItem(it.id, { done: !it.done })} title="Toggle done" aria-pressed={it.done} aria-label={it.done ? "Mark as not done" : "Mark as done"}>{it.done ? "✓" : ""}</button>
              <input className="ritem-label" value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} placeholder="Readiness item" aria-label="Readiness item" />
              <select className="mini-select w" value={it.weight} onChange={(e) => updateItem(it.id, { weight: Number(e.target.value) })} title="How much this counts toward the readiness score — 1 is minor, 5 is critical" aria-label="Weight, 1 to 5">
                {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>W{w}</option>)}
              </select>
              <button className={`blocker ${it.hardBlocker ? "on" : ""}`} onClick={() => updateItem(it.id, { hardBlocker: !it.hardBlocker })} title="Hard blocker — must be done to GO" aria-pressed={it.hardBlocker} aria-label={it.hardBlocker ? "Remove hard-blocker flag" : "Mark as a hard blocker"}>⚑</button>
              <button className="tool danger" title="Remove item" aria-label="Remove readiness item" onClick={() => removeItem(it.id)}>×</button>
            </div>
          ))}
        </div>
      ))}
      <button className="btn sm add-cat" onClick={() => addItem("General")}>+ Add readiness item</button>

      {/* Preflight — the hard blockers as a final go-check */}
      <div className="sec-head"><div><h2 className="sec-title">Preflight</h2><p className="hint">The must-haves. All green = clear to launch.</p></div></div>
      <div className="panel">
        {launch.readiness.filter((it) => it.hardBlocker).length === 0
          ? <p className="muted-panel" style={{ margin: 0 }}>No hard blockers marked — mark the truly can't-launch-without items with ⚑ above.</p>
          : (
            <ul className="pf-list">
              {launch.readiness.filter((it) => it.hardBlocker).map((it) => (
                <li key={it.id} className="pf-row">
                  <span className={`pf-dot ${it.done ? "on" : ""}`} aria-hidden="true">{it.done ? "✓" : "!"}</span>
                  <span className={it.done ? "pf-done" : ""}>{it.label || "(unnamed)"}{it.done ? " — done" : " — outstanding"}</span>
                </li>
              ))}
            </ul>
          )}
      </div>

      {/* Decision log */}
      <div className="sec-head"><div><h2 className="sec-title">Decision log</h2><p className="hint">Capture the calls you make so post-launch you know why.</p></div><button className="btn sm" onClick={addDecision}>+ Log decision</button></div>
      <div className="panel decisions">
        {launch.decisions.length === 0 ? <p className="muted-panel" style={{ margin: 0 }}>No decisions logged yet.</p>
          : launch.decisions.map((d) => (
            <div key={d.id} className="drow">
              <input className="drow-date" type="date" value={d.at} onChange={(e) => updateDecision(d.id, { at: e.target.value })} aria-label="Decision date" />
              <div className="drow-body">
                <input value={d.decision} onChange={(e) => updateDecision(d.id, { decision: e.target.value })} placeholder="Decision" aria-label="Decision" />
                <input value={d.rationale} onChange={(e) => updateDecision(d.id, { rationale: e.target.value })} placeholder="Why" aria-label="Why" />
              </div>
              <button className="tool danger" title="Remove decision" aria-label="Remove decision" onClick={() => removeDecision(d.id)}>×</button>
            </div>
          ))}
      </div>

      <label className="mini" style={{ margin: "4px 2px" }}><span>Launch notes / live log</span>
        <textarea className="ta tall" value={launch.notes} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Running notes — numbers, issues, what you're seeing during the launch." />
      </label>

      <div className="danger-row">
        <button className="btn ghost sm danger-btn" onClick={onDelete}>
          <MarketingIcon name="trash" size={13} /> Delete this launch
        </button>
      </div>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="lc-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.lc-root{
  /* Theme-aware colour tokens inherited from the shared design system — not
     hardcoded here (hardcoding froze the page in light mode). The focus ring is
     left un-redefined so it resolves to the system's real per-theme value
     instead of a colour frozen to the light theme. */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:920px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .lc-root{
  /* Softer, black-based shadows read better on the navy dark surface. */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.lc-root *{box-sizing:border-box;}
.lc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.lc-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:2px 0 0;line-height:1.6;}
.header-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.btn:active{transform:translateY(0);}
.btn:disabled{opacity:.5;cursor:default;transform:none;box-shadow:none;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;border-left:3px solid transparent;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);border-left-color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);border-left-color:var(--ds-danger);}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:120px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.muted-panel{color:var(--muted);font-size:13px;}
.lock{font-size:34px;}
input,textarea,select{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s;}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
input::placeholder,textarea::placeholder{color:var(--ds-text-disabled);}
.ta{min-height:56px;resize:vertical;}
.ta.tall{min-height:100px;}
.cols{display:flex;gap:12px;flex-wrap:wrap;}
.cols>*{flex:1;min-width:140px;}
.mini{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:500;color:var(--muted);}
.mini-select.w{flex:0 0 62px;font-weight:500;font-size:12px;}

/* Momentum strip — a quick "where things stand" read before the grid, so a
   portfolio of launches feels organised and in-motion, not just a pile of
   cards. Same flex/min-width trick as .cols above, just reused for stats. */
.momentum{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;}
.mstat{flex:1;min-width:140px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 16px;box-shadow:var(--ds-shadow-xs);display:flex;flex-direction:column;gap:2px;transition:box-shadow .15s var(--ds-ease),transform .15s var(--ds-ease),border-color .15s var(--ds-ease);}
.mstat:hover{box-shadow:var(--ds-shadow-md);transform:translateY(-1px);border-color:var(--ds-border-strong);}
.mstat.next{border-left:3px solid var(--ds-brand);}
.mnum{font-size:26px;font-weight:700;letter-spacing:-.5px;line-height:1.1;color:var(--text);}
.mnum-sm{font-size:15px;font-weight:700;letter-spacing:-.2px;color:var(--text);}
/* Subtle brand gradient on the one "hero" figure — the portfolio count.
   Solid brand-green fallback first for browsers without background-clip. */
.mnum.grad{color:var(--ds-brand);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){
  .mnum.grad{background:linear-gradient(90deg,var(--ds-brand),var(--ds-brand-hover));-webkit-background-clip:text;background-clip:text;color:transparent;}
}
.mlabel{font-size:11.5px;color:var(--muted);font-weight:500;}

/* List */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;}
.lcard{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:8px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s,box-shadow .15s,transform .1s;}
.lcard:hover{border-color:var(--ds-border-strong);box-shadow:var(--ds-shadow-md);transform:translateY(-1px);}
.lcard-top{display:flex;align-items:center;justify-content:space-between;}
.pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;}
.lcard-name{font-size:15.5px;margin:0;font-weight:700;letter-spacing:-.2px;}
.lcard-date{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:4px;}
.lcard-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:6px;gap:10px;}
.mini-gauge{display:flex;align-items:center;gap:7px;flex:1;font-size:12px;font-weight:700;color:var(--muted);}
.mini-bar{flex:1;height:6px;background:var(--ds-bg-subtle);border-radius:99px;overflow:hidden;}
.mini-bar span{display:block;height:100%;background:linear-gradient(90deg,var(--ds-brand),var(--ds-brand-hover));transition:width .3s var(--ds-ease);}
.go{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:.4px;}
.go.yes{background:var(--ds-success-soft);color:var(--ds-success);}
.go.no{background:var(--ds-danger-soft);color:var(--ds-danger);}
.rep-del{background:none;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);width:24px;height:24px;cursor:pointer;color:var(--muted);font-size:14px;line-height:1;transition:border-color .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease);}
.rep-del:hover{border-color:var(--ds-danger);color:var(--ds-danger);transform:translateY(-1px);}

/* Verdict — soft tinted band + accent left-border rather than a solid fill,
   so the GO/NO-GO colour stays accessible (AA) in both the light and the
   navy dark theme, where the raw success/danger hues run too pale for white
   text to sit on. */
.verdict{border-radius:var(--ds-radius-lg);padding:16px 18px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:10px;box-shadow:var(--ds-shadow-xs);border:1px solid;border-left-width:4px;}
.verdict.go{background:var(--ds-success-soft);border-color:color-mix(in srgb,var(--ds-success) 28%,transparent);border-left-color:var(--ds-success);}
.verdict.nogo{background:var(--ds-danger-soft);border-color:color-mix(in srgb,var(--ds-danger) 28%,transparent);border-left-color:var(--ds-danger);}
.verdict-left{display:flex;flex-direction:column;gap:4px;}
.verdict-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:3px 10px;border-radius:999px;width:fit-content;}
.verdict.go .verdict-badge{background:color-mix(in srgb,var(--ds-success) 16%,transparent);color:var(--ds-success);}
.verdict.nogo .verdict-badge{background:color-mix(in srgb,var(--ds-danger) 16%,transparent);color:var(--ds-danger);}
.verdict-go{font-size:26px;font-weight:700;letter-spacing:-.5px;}
.verdict.go .verdict-go{color:var(--ds-success);}
.verdict.nogo .verdict-go{color:var(--ds-danger);}
.verdict-gauge{flex:1;min-width:160px;}
.gauge-bar{height:9px;background:var(--ds-surface);border:1px solid var(--border);border-radius:99px;overflow:hidden;}
.gauge-bar span{display:block;height:100%;border-radius:99px;transition:width .3s var(--ds-ease);animation:lcGaugeFill .6s var(--ds-ease) both;}
.verdict.go .gauge-bar span{background:var(--ds-success);}
.verdict.nogo .gauge-bar span{background:var(--ds-danger);}
@keyframes lcGaugeFill{from{width:0 !important;}}
.gauge-lbl{font-size:12px;font-weight:500;margin-top:6px;color:var(--muted);}
.verdict-blockers{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-md);padding:9px 13px;font-size:12px;max-width:280px;box-shadow:var(--ds-shadow-xs);}
.vb-title{font-weight:700;color:var(--ds-danger);}
.verdict-blockers ul{margin:4px 0 0;padding-left:16px;color:var(--text);}
.verdict-hint{color:var(--ds-text-tertiary);font-size:12px;margin:0 2px 14px;}

.sec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:18px 2px 12px;}
.sec-title{font-size:18px;margin:0;letter-spacing:-.3px;}

/* Readiness */
.rcat{margin-bottom:12px;}
.rcat-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.rcat-name{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);}
.ritem{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-md);padding:7px 9px;margin-bottom:6px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s var(--ds-ease);}
.ritem:hover{border-color:var(--ds-border-strong);}
.ritem.done{background:var(--ds-surface-subtle);}
.check{width:24px;height:24px;border:1.5px solid var(--ds-border-strong);background:var(--surface);border-radius:6px;cursor:pointer;color:#fff;font-weight:700;font-size:13px;flex:none;display:grid;place-items:center;transition:background .15s var(--ds-ease),border-color .15s var(--ds-ease),transform .15s var(--ds-ease);}
.check:hover{border-color:var(--ds-brand);transform:translateY(-1px);}
/* Fixed dark-green fill (brand-solid) rather than --ds-success — the dark
   theme's success token is brightened for use as TEXT and fails contrast for
   a white checkmark sitting on top of it; brand-solid stays AA in both. */
.check.on{background:var(--ds-brand-solid);border-color:var(--ds-brand-solid);}
.check.on:hover{background:var(--ds-brand-solid-hover);border-color:var(--ds-brand-solid-hover);}
.ritem-label{flex:1;min-width:120px;border-color:transparent;background:transparent;font-weight:500;}
.ritem.done .ritem-label{text-decoration:line-through;color:var(--muted);}
.ritem-label:hover{background:var(--ds-bg-subtle);}
.ritem-label:focus{background:var(--surface);border-color:var(--accent);}
.blocker{width:28px;height:28px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;color:var(--ds-text-disabled);font-size:13px;flex:none;transition:background .15s var(--ds-ease),border-color .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease);}
.blocker:hover{border-color:var(--ds-danger);color:var(--ds-danger);transform:translateY(-1px);}
.blocker.on{color:var(--ds-danger);border-color:color-mix(in srgb,var(--ds-danger) 35%,transparent);background:var(--ds-danger-soft);}
.tool{width:28px;height:28px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;flex:none;transition:border-color .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease);}
.tool:hover{transform:translateY(-1px);}
.tool.danger:hover{border-color:var(--ds-danger);color:var(--ds-danger);}
.add-cat{margin:2px 0 8px;}

/* Preflight — a real list (not just styled divs) so a screen reader announces
   it as a list of N must-haves; each row also states "done"/"outstanding" in
   text so status never rides on colour or the dot glyph alone. */
.pf-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}
.pf-row{display:flex;align-items:center;gap:10px;font-size:13.5px;}
.pf-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:12px;flex:none;background:var(--ds-danger-soft);color:var(--ds-danger);border:1px solid color-mix(in srgb,var(--ds-danger) 30%,transparent);}
.pf-dot.on{background:var(--ds-success-soft);color:var(--ds-success);border-color:color-mix(in srgb,var(--ds-success) 30%,transparent);}
.pf-done{color:var(--muted);text-decoration:line-through;}

/* Decisions */
.decisions{display:flex;flex-direction:column;gap:8px;}
.drow{display:flex;gap:8px;align-items:flex-start;}
.drow-date{flex:0 0 150px;min-width:120px;}
.drow-body{flex:1;display:flex;flex-direction:column;gap:6px;}

.danger-row{margin-top:8px;}
.danger-btn:hover{color:var(--ds-danger);border-color:var(--ds-danger);}
.step-bar{position:sticky;bottom:14px;margin-top:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--ds-shadow-md);}
.step-count{font-size:12.5px;font-weight:500;color:var(--muted);}
.step-actions{display:flex;gap:9px;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion: reduce){ .lc-root *:not(.spinner){transition:none!important;animation:none!important;} }
`;
