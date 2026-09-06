"use client";
/**
 * Campaign Studio — Campaigns, Templates & Flows.
 *
 * The execution arm of Campaign Studio: a workspace's campaigns, each a named
 * initiative with an ordered multi-channel *flow* of steps. New campaigns can
 * start blank or from a built-in template (lib/templates.ts). Each flow step's
 * copy can be AI-generated from the workspace's Brand Brain — the OpenRouter
 * call happens in the browser with the user's own key (same key slot as the
 * Copilot and Brand Brain), so no key ever touches our server.
 *
 * Presentation is pinned to the DS light theme, matching the Brand Brain page,
 * so the whole Campaign Studio reads as one product.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { SkeletonCards } from "../../../components/Skeleton";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { confirmDialog } from "../../../components/Modal";
import { CHANNELS, channelMeta, type Channel } from "../../../lib/templates";
import { AI_PROVIDERS, getAIProvider, keyLooksValid, type AIProviderId } from "../../../lib/ai/providers";
import { callAI, loadConnection, saveConnection } from "../../../lib/ai/client";
import { brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, strategyBlock, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";

type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "done";
// Each status carries a foreground/soft-background pair plus a plain-language
// note. Colours are theme-aware CSS vars (defined in the .cs-root block) — three
// map straight onto DS semantic tokens, scheduled/done keep a distinct accent
// that's redefined for dark mode — so every pill stays legible and AA in both
// themes instead of freezing at a light-only hex.
const STATUS_META: Record<CampaignStatus, { label: string; hue: string; soft: string; help: string }> = {
  draft: { label: "Draft", hue: "var(--st-draft-fg)", soft: "var(--st-draft-bg)", help: "Not started — still being shaped." },
  scheduled: { label: "Scheduled", hue: "var(--st-sched-fg)", soft: "var(--st-sched-bg)", help: "Queued to go live on its start date." },
  active: { label: "Active", hue: "var(--st-active-fg)", soft: "var(--st-active-bg)", help: "Live and running right now." },
  paused: { label: "Paused", hue: "var(--st-paused-fg)", soft: "var(--st-paused-bg)", help: "Temporarily stopped — needs a decision." },
  done: { label: "Done", hue: "var(--st-done-fg)", soft: "var(--st-done-bg)", help: "Wrapped up and complete." },
};
const STATUS_ORDER: CampaignStatus[] = ["draft", "scheduled", "active", "paused", "done"];

interface FlowStep { id: string; channel: Channel; kind: string; title: string; content: string; day: number; }
interface Campaign {
  id: string; name: string; objective: string; status: CampaignStatus; channel: string;
  budget: string; startsAt: string; endsAt: string; templateId: string; flow: FlowStep[];
  createdAt: string; updatedAt: string;
}
interface Template { id: string; name: string; category: string; description: string; objective: string; channel: string; steps: Omit<FlowStep, "id">[]; }

async function generate(provider: AIProviderId, key: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  return callAI({ provider, apiKey: key, model }, system, user, maxTokens);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span className="kv-label">{label}</span>{children}</label>;
}

type ViewState = "loading" | "ok" | "not-authenticated" | "not-enabled" | "forbidden" | "error";

export default function CampaignsPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [deletedCampaigns, setDeletedCampaigns] = useState<{ id: string; name: string; deletedAt: string }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // AI connection — provider + key + model, a shared slot across the app.
  const [aiProvider, setAiProvider] = useState<AIProviderId>("openrouter");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const c = loadConnection();
    if (c) { setAiProvider(c.provider); setAiKey(c.apiKey); setAiModel(c.model); }
  }, []);
  const persist = (provider: AIProviderId, key: string, model: string) => saveConnection({ provider, apiKey: key, model });
  const saveProvider = (p: AIProviderId) => { setAiProvider(p); persist(p, aiKey, aiModel); };
  const saveKey = (k: string) => { setAiKey(k); persist(aiProvider, k, aiModel); };
  const saveModel = (m: string) => { setAiModel(m); persist(aiProvider, aiKey, m); };

  const load = useCallback(async () => {
    setState("loading"); setErr("");
    try {
      const r = await fetch("/api/campaign-studio/campaigns", { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) {
        const b = await r.json().catch(() => ({})) as { error?: string };
        setState(b.error?.includes("enabled") ? "not-enabled" : "forbidden"); return;
      }
      if (!r.ok) { setState("error"); return; }
      const data = await r.json() as { campaigns: Campaign[]; templates: Template[] };
      setCampaigns(data.campaigns); setTemplates(data.templates);
      // Brand profile is best-effort — used only for AI context.
      fetch("/api/campaign-studio/brand", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((b) => { if (b) setBrand(b as BrandProfile); })
        .catch(() => { /* ignore */ });
      void loadStrategyBrief().then(setStrategy); // best-effort Business-OS strategy for AI context
      setState("ok");
      void loadDeletedCampaigns();
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loadDeletedCampaigns = useCallback(async () => {
    try {
      const r = await fetch("/api/campaign-studio/campaigns/deleted", { credentials: "include" });
      if (r.ok) { const d = await r.json(); setDeletedCampaigns(Array.isArray(d.deleted) ? d.deleted : []); }
    } catch { /* non-critical */ }
  }, []);
  const restoreCampaign = async (id: string) => {
    try { const r = await fetch(`/api/campaign-studio/campaigns/deleted?id=${encodeURIComponent(id)}`, { method: "POST", credentials: "include" }); if (r.ok) void load(); } catch { /* ignore */ }
  };
  const purgeCampaign = async (id: string, name: string) => {
    if (!(await confirmDialog({ title: `Delete "${name}" forever?`, message: "This cannot be undone.", danger: true, confirmLabel: "Delete forever", requireType: "DELETE" }))) return;
    try { await fetch(`/api/campaign-studio/campaigns?id=${encodeURIComponent(id)}&permanent=1`, { method: "DELETE", credentials: "include" }); void loadDeletedCampaigns(); } catch { /* ignore */ }
  };

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2500); };

  const createCampaign = async (templateId?: string, name?: string) => {
    setErr("");
    try {
      const r = await fetch("/api/campaign-studio/campaigns", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId, name: name ?? "" }),
      });
      const b = await r.json() as { campaign?: Campaign; error?: string };
      if (!r.ok || !b.campaign) { setErr(b.error ?? "Could not create the campaign."); return; }
      setCampaigns((prev) => [b.campaign as Campaign, ...prev]);
      setPicker(false); setEditingId(b.campaign.id);
    } catch { setErr("Could not create the campaign."); }
  };

  const removeCampaign = async (id: string) => {
    setErr("");
    try {
      const r = await fetch(`/api/campaign-studio/campaigns?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { setErr("Could not delete the campaign."); return; }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      void loadDeletedCampaigns();
      if (editingId === id) setEditingId(null);
      flash("Campaign deleted.");
    } catch { setErr("Could not delete the campaign."); }
  };

  const editing = useMemo(() => campaigns.find((c) => c.id === editingId) ?? null, [campaigns, editingId]);
  const patchLocal = (id: string, patch: Partial<Campaign>) =>
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  if (state === "loading") return <Shell><SkeletonCards count={6} /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to use Campaign Studio." href="/" cta="Go to sign in" /></Shell>;
  if (state === "not-enabled") return <Shell><Notice icon="✨" title="Campaign Studio isn't enabled" body="Campaigns, templates and flows are part of Campaign Studio — a separately-priced add-on. Enable it to start building campaigns." href="/campaign-studio/brand" cta="About Campaign Studio" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't load your campaigns." onRetry={() => void load()} /></Shell>;

  return (
    <Shell>
      <div className="cs-header">
        <div>
          <div className="eyebrow">Campaign Studio</div>
          <h1>{editing ? "Edit campaign" : "Campaigns"}</h1>
          <p className="sub">{editing ? "Shape the objective, the channels and the step-by-step flow." : "Build multi-channel campaigns from proven templates, then let AI write each step from your Brand Brain."}</p>
          <div style={{ marginTop: 8 }}><GroundingChips brand={hasBrand(brand)} strategy={!!strategy?.has} /></div>
        </div>
        <div className="header-right">
          {!editing && <a href="/campaign-studio/brand" className="btn ghost sm"><MarketingIcon name="book" size={14} /> Brand Brain</a>}
          {!editing && <a href="/campaign-studio/connections" className="btn ghost sm"><MarketingIcon name="link" size={14} /> Connections</a>}
          {!editing && <a href="/" className="btn ghost sm"><MarketingIcon name="home" size={14} /> Home</a>}
          <a className="btn ghost sm" href="/campaign-studio/write" title="Write an email or landing page section by section with AI" style={{ textDecoration: "none" }}><MarketingIcon name="pen" size={14} /> Asset Writer</a>
          <button className="btn ghost sm" onClick={() => setAiOpen((v) => !v)} title="AI provider settings"><MarketingIcon name="gear" size={14} /> AI</button>
          {editing
            ? <button className="btn" onClick={() => setEditingId(null)}>← All campaigns</button>
            : <button className="btn primary" onClick={() => setPicker(true)}>+ New campaign</button>}
        </div>
      </div>

      {aiOpen && (() => {
        const prov = getAIProvider(aiProvider);
        const isManual = aiProvider === "manual";
        return (
        <div className="ai-key-card">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {AI_PROVIDERS.map((p) => {
              const on = aiProvider === p.id;
              return (
                <button key={p.id} type="button" onClick={() => saveProvider(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 500,
                    border: `1px solid ${on ? p.hue : "var(--ds-border-default)"}`, background: on ? `${p.hue}14` : "transparent", color: on ? p.hue : "inherit" }}>
                  <span>{p.icon}</span>{p.name}
                </button>
              );
            })}
          </div>
          {!isManual && (
            <div className="cols">
              <Field label={`${prov?.name ?? "Provider"} API key (saved to your account, sent straight to the provider)`}>
                <input type="password" value={aiKey} onChange={(e) => saveKey(e.target.value)} placeholder={prov?.keyPrefix ? `${prov.keyPrefix}…` : "your API key"} autoComplete="off" />
              </Field>
              <Field label="Model">
                <input value={aiModel} onChange={(e) => saveModel(e.target.value)} placeholder={prov?.defaultModel} list="ai-model-suggestions" />
                <datalist id="ai-model-suggestions">{(prov?.models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
              </Field>
            </div>
          )}
          <p className="hint">
            {prov?.note}{" "}
            {prov?.keyUrl && <a href={prov.keyUrl} target="_blank" rel="noreferrer">Get a key →</a>}
          </p>
          {!isManual && prov && aiKey.trim() && !keyLooksValid(prov, aiKey) && (
            <p className="hint" style={{ color: "#C93400" }}>That doesn&apos;t look like a {prov.name} key{prov.keyPrefix ? ` (expected ${prov.keyPrefix}…)` : ""} — double-check it.</p>
          )}
        </div>
        );
      })()}

      {msg && <div className="msg ok" role="status" aria-live="polite">{msg}</div>}
      {err && <div className="msg err" role="alert">{err}</div>}

      {editing
        ? <CampaignEditor
            key={editing.id}
            campaign={editing}
            brand={brand}
            strategy={strategy}
            aiProvider={aiProvider}
            aiKey={aiKey}
            aiModel={aiModel}
            onNeedKey={() => setAiOpen(true)}
            onLocalChange={(patch) => patchLocal(editing.id, patch)}
            onSaved={() => flash("Saved.")}
            onError={setErr}
            onDelete={() => void removeCampaign(editing.id)}
          />
        : <CampaignList campaigns={campaigns} onOpen={setEditingId} onNew={() => setPicker(true)} onDelete={(id) => void removeCampaign(id)}
            deleted={deletedCampaigns} onRestore={(id) => void restoreCampaign(id)} onPurge={(id, name) => void purgeCampaign(id, name)} />}

      {picker && (
        <TemplatePicker templates={templates} onClose={() => setPicker(false)} onPick={(id) => void createCampaign(id)} onBlank={() => void createCampaign(undefined, "Untitled campaign")} />
      )}
    </Shell>
  );
}

function CampaignList({ campaigns, onOpen, onNew, onDelete, deleted, onRestore, onPurge }: { campaigns: Campaign[]; onOpen: (id: string) => void; onNew: () => void; onDelete: (id: string) => void; deleted: { id: string; name: string; deletedAt: string }[]; onRestore: (id: string) => void; onPurge: (id: string, name: string) => void }) {
  if (campaigns.length === 0 && deleted.length === 0) {
    return (
      <div className="panel notice">
        <div className="lock">🚀</div>
        <h2>No campaigns yet</h2>
        <p className="sub">Start from a proven template — a lead-magnet funnel, a launch runway, a nurture sequence — or a blank campaign.</p>
        <button className="btn primary" onClick={onNew}>+ New campaign</button>
      </div>
    );
  }
  return (
    <>
    <div className="grid">
      {campaigns.map((c) => {
        const st = STATUS_META[c.status];
        return (
          <div key={c.id} className="ccard" role="button" tabIndex={0}
            onClick={() => onOpen(c.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c.id); } }}>
            <div className="ccard-top">
              <span className="pill" style={{ color: st.hue, background: st.soft }}>{st.label}</span>
              <button className="rep-del sm" aria-label="Delete campaign" title="Delete campaign"
                onClick={async (e) => { e.stopPropagation(); if (await confirmDialog({ title: `Delete "${c.name}"?`, message: "It moves to Recently deleted — restorable for 30 days.", danger: true, confirmLabel: "Delete" })) onDelete(c.id); }}
                onKeyDown={(e) => e.stopPropagation()}>×</button>
            </div>
            <h3 className="ccard-name">{c.name}</h3>
            {c.objective && <p className="ccard-obj">{c.objective}</p>}
            <div className="ccard-foot">
              <div className="chan-dots">
                {[...new Set(c.flow.map((s) => s.channel))].slice(0, 6).map((ch) => {
                  const m = channelMeta(ch);
                  return <span key={ch} className="chan-dot" style={{ background: m.hue }} title={m.label}>{m.icon}</span>;
                })}
              </div>
              <span className="ccard-steps">{c.flow.length} step{c.flow.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        );
      })}
    </div>
    {deleted.length > 0 && (
      <div style={{ marginTop: 26 }}>
        <div className="card-h" style={{ marginBottom: 10, fontSize: 14, fontWeight: 700 }}>🗑 Recently deleted <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 12 }}>· restorable for 30 days</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {deleted.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{d.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>deleted {new Date(d.deletedAt).toLocaleDateString()}</div>
              </div>
              <button className="btn tiny primary" onClick={() => onRestore(d.id)}>Restore</button>
              <button className="btn tiny danger" onClick={() => onPurge(d.id, d.name)}>Delete forever</button>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  );
}

function TemplatePicker({ templates, onClose, onPick, onBlank }: { templates: Template[]; onClose: () => void; onPick: (id: string) => void; onBlank: () => void }) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Start a campaign</div>
            <h2>Choose a template</h2>
          </div>
          <button className="btn ghost sm" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <p className="hint">Each template lays out a proven flow across channels. You can rewrite every step afterwards.</p>
        <div className="tpl-grid">
          {templates.map((t) => (
            <button key={t.id} className="tpl" onClick={() => onPick(t.id)}>
              <div className="tpl-cat">{t.category}</div>
              <div className="tpl-name">{t.name}</div>
              <p className="tpl-desc">{t.description}</p>
              <div className="tpl-foot">
                <div className="chan-dots">
                  {[...new Set(t.steps.map((s) => s.channel))].slice(0, 6).map((ch) => {
                    const m = channelMeta(ch);
                    return <span key={ch} className="chan-dot" style={{ background: m.hue }} title={m.label}>{m.icon}</span>;
                  })}
                </div>
                <span className="ccard-steps">{t.steps.length} steps →</span>
              </div>
            </button>
          ))}
          <button className="tpl blank" onClick={onBlank}>
            <div className="tpl-cat">Blank</div>
            <div className="tpl-name">Start from scratch</div>
            <p className="tpl-desc">An empty campaign — add your own steps and channels.</p>
            <div className="tpl-foot"><span className="ccard-steps">Create →</span></div>
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignEditor({
  campaign, brand, strategy, aiProvider, aiKey, aiModel, onNeedKey, onLocalChange, onSaved, onError, onDelete,
}: {
  campaign: Campaign; brand: BrandProfile | null; strategy: StrategyBrief | null; aiProvider: AIProviderId; aiKey: string; aiModel: string;
  onNeedKey: () => void; onLocalChange: (patch: Partial<Campaign>) => void;
  onSaved: () => void; onError: (m: string) => void; onDelete: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aiStep, setAiStep] = useState<string | null>(null); // step id being generated
  const latest = useRef(campaign);
  latest.current = campaign;

  const set = (patch: Partial<Campaign>) => { onLocalChange(patch); setDirty(true); };
  const setFlow = (flow: FlowStep[]) => set({ flow });

  const save = useCallback(async () => {
    setSaving(true); onError("");
    const c = latest.current;
    try {
      const r = await fetch("/api/campaign-studio/campaigns", {
        method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: c.id, name: c.name, objective: c.objective, status: c.status,
          channel: c.channel, budget: c.budget, startsAt: c.startsAt, endsAt: c.endsAt, flow: c.flow,
        }),
      });
      const b = await r.json() as { error?: string };
      if (!r.ok) { onError(b.error ?? "Could not save."); return; }
      setDirty(false); onSaved();
    } catch { onError("Could not save."); }
    finally { setSaving(false); }
  }, [onError, onSaved]);

  const newStep = (): FlowStep => ({ id: (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36), channel: "email", kind: "email", title: "New step", content: "", day: 0 });
  const addStep = () => setFlow([...campaign.flow, newStep()]);
  const updateStep = (id: string, patch: Partial<FlowStep>) => setFlow(campaign.flow.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeStep = (id: string) => setFlow(campaign.flow.filter((s) => s.id !== id));
  const moveStep = (id: string, dir: -1 | 1) => {
    const i = campaign.flow.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= campaign.flow.length) return;
    const next = [...campaign.flow];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setFlow(next);
  };
  const duplicateStep = (id: string) => {
    const i = campaign.flow.findIndex((s) => s.id === id);
    const original = campaign.flow[i];
    if (i < 0 || !original) return;
    const copy = { ...original, id: newStep().id, title: `${original.title} (copy)` };
    const next = [...campaign.flow];
    next.splice(i + 1, 0, copy);
    setFlow(next);
  };

  const generateStep = async (step: FlowStep) => {
    if (aiProvider === "manual") { onNeedKey(); onError("Connect an AI provider first (the AI button) — or write the copy yourself."); return; }
    setAiStep(step.id); onError("");
    try {
      const channelLabel = channelMeta(step.channel).label;
      const system = [
        "You are a senior direct-response copywriter. Write ready-to-use marketing copy that fits the brand exactly.",
        "Match the brand voice. Be specific and concrete. No placeholders, no meta commentary — return only the copy itself.",
        step.channel === "email" ? "Return a subject line on the first line, then a blank line, then the email body."
          : step.channel === "sms" ? "Keep it under 160 characters."
          : step.channel === "landing" ? "Return a headline, a short subhead, 3 benefit bullets, and one call-to-action."
          : "Return a short punchy piece of copy (a hook, primary text, and a call-to-action).",
      ].join(" ");
      const user = [
        `BRAND\n${brandBrief(brand)}`,
        strategyBlock(strategy) ? `\n${strategyBlock(strategy)}` : "",
        `\nCAMPAIGN\nName: ${campaign.name}\nObjective: ${campaign.objective || "(none set)"}`,
        `\nSTEP\nChannel: ${channelLabel}\nStep: ${step.title}\nWhat this step should do: ${step.content || step.title}`,
        `\nWrite the ${channelLabel} copy for this step now.`,
      ].join("\n");
      const reply = await generate(aiProvider, aiKey, aiModel, system, user, 500);
      if (!reply) { onError("The AI returned nothing — try again."); return; }
      updateStep(step.id, { content: reply });
    } catch (e) { onError(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setAiStep(null); }
  };

  return (
    <>
      <div className="panel">
        <div className="cols">
          <Field label="Campaign name"><input value={campaign.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Status">
            <select value={campaign.status} onChange={(e) => set({ status: e.target.value as CampaignStatus })}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Objective — what should this campaign achieve?">
          <textarea className="ta" value={campaign.objective} onChange={(e) => set({ objective: e.target.value })} placeholder="e.g. Book 20 discovery calls from cold traffic this month." />
        </Field>
        <div className="cols">
          <Field label="Primary channel(s)"><input value={campaign.channel} onChange={(e) => set({ channel: e.target.value })} placeholder="Meta + Email" /></Field>
          <Field label="Budget"><input value={campaign.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="$1,500" /></Field>
          <Field label="Starts"><input type="date" value={campaign.startsAt} onChange={(e) => set({ startsAt: e.target.value })} /></Field>
          <Field label="Ends"><input type="date" value={campaign.endsAt} onChange={(e) => set({ endsAt: e.target.value })} /></Field>
        </div>
      </div>

      <div className="flow-head">
        <div>
          <h2 className="flow-title">Flow</h2>
          <p className="hint">The ordered steps of this campaign across channels. Generate each step's copy from your Brand Brain.</p>
        </div>
        <button className="btn sm" onClick={addStep}>+ Add step</button>
      </div>

      {campaign.flow.length === 0 && <div className="panel center muted-panel">No steps yet — add one, or start this campaign from a template next time.</div>}

      <div className="flow">
        {campaign.flow.map((step, idx) => {
          const m = channelMeta(step.channel);
          return (
            <div key={step.id} className="fstep">
              <div className="fstep-rail">
                <span className="fstep-idx" style={{ background: m.hue }}>{idx + 1}</span>
                {idx < campaign.flow.length - 1 && <span className="fstep-line" />}
              </div>
              <div className="fstep-body">
                <div className="fstep-top">
                  <input className="fstep-title" value={step.title} onChange={(e) => updateStep(step.id, { title: e.target.value })} placeholder="Step title" />
                  <div className="fstep-tools">
                    <button className="tool" aria-label="Move step up" title="Move up" onClick={() => moveStep(step.id, -1)} disabled={idx === 0}>↑</button>
                    <button className="tool" aria-label="Move step down" title="Move down" onClick={() => moveStep(step.id, 1)} disabled={idx === campaign.flow.length - 1}>↓</button>
                    <button className="tool" aria-label="Duplicate step" title="Duplicate" onClick={() => duplicateStep(step.id)}>⧉</button>
                    <button className="tool danger" aria-label="Remove step" title="Remove" onClick={() => removeStep(step.id)}>×</button>
                  </div>
                </div>
                <div className="fstep-meta">
                  <label className="mini">
                    <span>Channel</span>
                    <select value={step.channel} onChange={(e) => updateStep(step.id, { channel: e.target.value as Channel })}>
                      {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="mini">
                    <span>Type</span>
                    <input value={step.kind} onChange={(e) => updateStep(step.id, { kind: e.target.value })} placeholder="ad / email / post" />
                  </label>
                  <label className="mini day">
                    <span>Day</span>
                    <input type="number" value={step.day} onChange={(e) => updateStep(step.id, { day: Number(e.target.value) || 0 })} />
                  </label>
                </div>
                <textarea className="ta fstep-content" value={step.content} onChange={(e) => updateStep(step.id, { content: e.target.value })} placeholder="What this step says — or generate it from your Brand Brain." />
                <div className="fstep-actions">
                  <button className="btn sm ai" onClick={() => void generateStep(step)} disabled={aiStep === step.id}>
                    {aiStep === step.id ? <><span className="mini-spin" /> Writing…</> : <><MarketingIcon name="spark" size={13} /> Generate with AI</>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="step-bar">
        <div className="step-count">{dirty ? "Unsaved changes" : "All changes saved"}</div>
        <div className="step-actions">
          <button className="btn ghost sm" onClick={async () => { if (await confirmDialog({ title: `Delete "${campaign.name}"?`, message: "It moves to Recently deleted — restorable for 30 days.", danger: true, confirmLabel: "Delete" })) onDelete(); }}>Delete campaign</button>
          <button className="btn primary" onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Saving…" : "Save campaign"}</button>
        </div>
      </div>
    </>
  );
}


function Shell({ children }: { children: ReactNode }) {
  return <div className="cs-root"><style>{CSS}</style>{children}</div>;
}

const CSS = `
.cs-root{
  /* Theme-aware colour tokens inherited from the shared design system — not
     hardcoded here (hardcoding froze the page in light mode). */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ring:0 0 0 3px rgba(10,158,110,.2);--ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:960px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
.cs-root *{box-sizing:border-box;}
.cs-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.cs-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:60ch;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:0 0 8px;}
.header-right{display:flex;gap:8px;align-items:center;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.btn.ai{border-color:var(--ds-brand);color:var(--ds-brand);background:var(--ds-brand-soft);}
.btn.ai:hover{background:#e7e3ff;}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:22px;display:flex;flex-direction:column;gap:16px;box-shadow:var(--ds-shadow-xs);margin-bottom:16px;}
.panel.center{align-items:center;justify-content:center;min-height:160px;text-align:center;gap:10px;color:var(--muted);}
.panel.notice{align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.muted-panel{color:var(--muted);font-size:13.5px;}
.lock{font-size:34px;}
.field{display:flex;flex-direction:column;gap:5px;flex:1;min-width:170px;}
.kv-label{font-size:12px;font-weight:500;color:var(--text);}
.cols{display:flex;gap:14px;flex-wrap:wrap;}
.cols>*{flex:1;min-width:160px;}
input,textarea,select{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:9px 11px;font-size:13.5px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s;}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
input::placeholder,textarea::placeholder{color:var(--ds-text-disabled);}
.ta{min-height:64px;resize:vertical;font-family:inherit;}

/* Campaign list */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.ccard{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:9px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s,box-shadow .15s,transform .1s;}
.ccard:hover{border-color:var(--ds-border-strong);box-shadow:var(--ds-shadow-md);transform:translateY(-1px);}
.ccard:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.ccard-top{display:flex;align-items:center;justify-content:space-between;}
.pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:.2px;}
.ccard-name{font-size:15.5px;margin:0;font-weight:700;letter-spacing:-.2px;}
.ccard-obj{font-size:12.5px;color:var(--muted);margin:0;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.ccard-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:6px;}
.chan-dots{display:flex;gap:4px;}
.chan-dot{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;color:#fff;font-size:11px;font-weight:700;}
.ccard-steps{font-size:12px;color:var(--ds-text-tertiary);font-weight:500;}
.rep-del{background:none;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);width:28px;height:28px;flex:none;cursor:pointer;color:var(--muted);font-size:16px;line-height:1;}
.rep-del:hover{border-color:var(--ds-danger);color:var(--ds-danger);}
.rep-del.sm{width:24px;height:24px;font-size:14px;}

/* Template picker modal */
.modal-scrim{position:fixed;inset:0;background:rgba(15,23,42,.4);display:grid;place-items:center;padding:20px;z-index:50;}
.modal{background:var(--ds-bg-app);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:22px;max-width:820px;width:100%;max-height:88vh;overflow:auto;box-shadow:var(--ds-shadow-md);}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px;}
.modal-head h2{margin:2px 0 0;font-size:20px;}
.tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:8px;}
.tpl{text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:15px;cursor:pointer;display:flex;flex-direction:column;gap:6px;transition:border-color .15s,box-shadow .15s,transform .1s;font:inherit;color:var(--text);}
.tpl:hover{border-color:var(--ds-brand);box-shadow:var(--ds-shadow-md);transform:translateY(-1px);}
.tpl.blank{border-style:dashed;background:var(--ds-surface-subtle);}
.tpl-cat{font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;font-weight:700;color:var(--ds-brand);}
.tpl-name{font-size:15px;font-weight:700;}
.tpl-desc{font-size:12.5px;color:var(--muted);margin:0;line-height:1.45;flex:1;}
.tpl-foot{display:flex;align-items:center;justify-content:space-between;margin-top:4px;}

/* Flow builder */
.flow-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:6px 2px 12px;}
.flow-title{font-size:18px;margin:0;letter-spacing:-.3px;}
.flow{display:flex;flex-direction:column;gap:0;}
.fstep{display:flex;gap:14px;}
.fstep-rail{display:flex;flex-direction:column;align-items:center;flex:none;width:32px;}
.fstep-idx{width:28px;height:28px;border-radius:50%;color:#fff;font-weight:700;font-size:13px;display:grid;place-items:center;flex:none;}
.fstep-line{flex:1;width:2px;background:var(--ds-border-default);margin:4px 0;min-height:14px;}
.fstep-body{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px 15px;margin-bottom:12px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--ds-shadow-xs);}
.fstep-top{display:flex;align-items:center;gap:10px;}
.fstep-title{font-weight:700;font-size:14.5px;border:1px solid transparent;background:transparent;padding:5px 7px;border-radius:var(--ds-radius-sm);}
.fstep-title:hover{background:var(--ds-surface-subtle);}
.fstep-title:focus{background:var(--surface);border-color:var(--accent);}
.fstep-tools{display:flex;gap:4px;flex:none;}
.tool{width:28px;height:28px;border:1px solid var(--ds-border-default);background:var(--surface);border-radius:var(--ds-radius-sm);cursor:pointer;color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;}
.tool:hover{border-color:var(--ds-border-strong);color:var(--text);}
.tool:disabled{opacity:.35;cursor:default;}
.tool.danger:hover{border-color:var(--ds-danger);color:var(--ds-danger);}
.fstep-meta{display:flex;gap:10px;flex-wrap:wrap;}
.mini{display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:500;color:var(--muted);flex:1;min-width:120px;}
.mini.day{flex:0 0 80px;min-width:70px;}
.fstep-content{min-height:80px;}
.fstep-actions{display:flex;gap:8px;}
.mini-spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(10,158,110,.32);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;vertical-align:-1px;}

.ai-key-card{background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:15px 17px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px;}
.step-bar{position:sticky;bottom:14px;margin-top:8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--ds-shadow-md);}
.step-count{font-size:12.5px;font-weight:500;color:var(--muted);}
.step-actions{display:flex;gap:9px;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
`;
