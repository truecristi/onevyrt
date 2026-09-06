"use client";

import { useCallback, useEffect, useState } from "react";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { AiConnectFields } from "../../../components/AiConnectFields";
import { Notice } from "../../../components/ui/Notice";

interface Connection { provider: string; accountName: string; accountId?: string; status: "connected" | "needs_attention"; connectedAt: string; }
interface ProviderView {
  id: string; name: string; kind: "ads" | "ads+social" | "ai"; hue: string; icon: string; note: string;
  connection: Connection | null;
}
type ViewState = "loading" | "ok" | "not-authenticated" | "not-enabled" | "forbidden" | "error";

const KIND_LABEL: Record<ProviderView["kind"], string> = { ads: "Ads", "ads+social": "Ads + Social", ai: "AI" };

export default function ConnectionsPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [msg, setMsg] = useState("");
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [idDraft, setIdDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading"); setMsg("");
    try {
      const r = await fetch("/api/campaign-studio/connections", { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { const d = await r.json().catch(() => ({})); setState(d.error?.includes?.("enabled") ? "not-enabled" : "forbidden"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json() as { providers: ProviderView[] };
      setProviders(d.providers);
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const connect = useCallback(async (provider: string) => {
    if (!nameDraft.trim()) { setMsg("Give the account a name."); return; }
    setBusy(provider); setMsg("");
    try {
      const r = await fetch("/api/campaign-studio/connections", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, action: "connect", accountName: nameDraft, accountId: idDraft }) });
      const d = await r.json() as { connection?: Connection; error?: string };
      if (!r.ok || !d.connection) { setMsg(d.error ?? "Could not connect."); setBusy(null); return; }
      setProviders((list) => list.map((p) => p.id === provider ? { ...p, connection: d.connection! } : p));
      setOpenForm(null); setNameDraft(""); setIdDraft("");
      setMsg("Linked ✓");
    } catch { setMsg("Network error."); }
    setBusy(null);
  }, [nameDraft, idDraft]);

  const disconnect = useCallback(async (provider: string) => {
    setBusy(provider); setMsg("");
    try {
      const r = await fetch("/api/campaign-studio/connections", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, action: "disconnect" }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? "Could not disconnect."); setBusy(null); return; }
      setProviders((list) => list.map((p) => p.id === provider ? { ...p, connection: null } : p));
      setMsg("Disconnected.");
    } catch { setMsg("Network error."); }
    setBusy(null);
  }, []);

  return (
    <div className="cx-root">
      <style>{CSS}</style>
      <header className="cx-header">
        <div>
          <div className="eyebrow">CAMPAIGN STUDIO</div>
          <h1>Connected accounts</h1>
          <p className="sub">Link your ad and social platforms so everything Campaign Studio builds can publish and report against them.</p>
        </div>
        <div className="header-right">
          <a href="/campaign-studio/brand" className="btn ghost"><MarketingIcon name="book" size={14} /> Brand Brain</a>
          <a href="/" className="btn ghost">← Back</a>
        </div>
      </header>

      {msg && (
        <div className={`msg ${msg.includes("✓") ? "ok" : "err"}`} role="status" aria-live="polite">
          <MarketingIcon name={msg.includes("✓") ? "check" : "warning"} size={14} />
          <span>{msg}</span>
        </div>
      )}

      {state === "loading" && <div className="panel center"><div className="spinner" /><p className="sub">Loading your connections…</p></div>}
      {state === "error" && <Notice icon="⚠️" title="Something went wrong" onRetry={() => void load()} />}
      {state === "not-authenticated" && <Notice icon="🔑" title="Sign in required" body="Sign in to view or manage this workspace's connected accounts." href="/" cta="Go to sign in" />}
      {state === "forbidden" && <Notice icon="🔒" title="Not a member of this workspace" body="Ask an admin to add you to this workspace to view or manage its connections." />}
      {state === "not-enabled" && <Notice icon="🔒" title="Campaign Studio isn't enabled here" body="Connections are part of Campaign Studio — included with Performance, or available as an add-on for Pro / Business." />}

      {state === "ok" && (
        <>
          {/* The AI provider key lives here too, so the app's own "Connect AI →"
              prompts (which point at this page) actually land somewhere you can
              paste a key — not just ad/social accounts. */}
          <section className="ai-card">
            <div className="ai-card-head">
              <span className="cx-sec-icon" style={{ background: "var(--ds-brand-soft)", color: "var(--ds-brand-active)" }}><MarketingIcon name="spark" size={14} /></span>
              <div>
                <h2>Your AI provider</h2>
                <p className="sub">Add a one-time key so the &ldquo;Draft with AI&rdquo; buttons across the app can write for you. Stored encrypted, per workspace — never shared with the platforms below.</p>
              </div>
            </div>
            <AiConnectFields />
          </section>

          <div className="callout">
            <span className="callout-ic"><MarketingIcon name="signal" size={14} /></span>
            <div>
              <b>How connecting works — and why it&apos;s safe</b>
              <p>Recording an account here just links it to your workspace — nothing is sent to the platform yet, and you can disconnect at any time. Going <em>live</em> — publishing campaigns or pulling auto-reports — also needs that platform&apos;s own API approval (a developer app + review you set up once, per platform), noted on each card below.</p>
            </div>
          </div>

          <div className="sec-title">
            <span className="cx-sec-icon sm" style={{ background: "var(--ds-bg-subtle)", color: "var(--ds-text-secondary)" }}><MarketingIcon name="link" size={12} /></span>
            Ad &amp; social platforms
          </div>
          <p className="cx-sec-why">Pick the ones you actually run ads or content on — connecting is optional, so leave the rest for later.</p>

          <div className="grid">
            {providers.map((p) => (
              <div className={`prov-card ${p.connection ? "connected" : ""}`} key={p.id}>
                <div className="prov-top">
                  <span className="prov-ic" aria-hidden="true" style={{ background: `${p.hue}22`, borderColor: `${p.hue}66` }}>{p.icon}</span>
                  <div className="prov-meta">
                    <div className="prov-name">{p.name}</div>
                    <span className={`kind kind-${p.kind.replace("+", "")}`}>{KIND_LABEL[p.kind]}</span>
                  </div>
                  {p.connection
                    ? <span className="chip ok" title="Linked in your workspace — live publishing & auto-reporting still require this platform's own API approval."><MarketingIcon name="check" size={11} /> Linked</span>
                    : <span className="chip off">Not linked</span>}
                </div>

                {p.connection ? (
                  <div className="prov-body">
                    <div className="acc"><b>{p.connection.accountName}</b>{p.connection.accountId ? <span className="acc-id"> · {p.connection.accountId}</span> : null}</div>
                    <div className="prov-actions">
                      <button className="btn ghost sm" onClick={() => { setOpenForm(p.id); setNameDraft(p.connection?.accountName ?? ""); setIdDraft(p.connection?.accountId ?? ""); }}><MarketingIcon name="pen" size={12} /> Edit</button>
                      <button className="btn ghost sm danger" onClick={() => void disconnect(p.id)} disabled={busy === p.id}>{busy === p.id ? "Removing…" : "Disconnect"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="prov-body">
                    <p className="note">{p.note}</p>
                    <button className="btn primary sm" onClick={() => { setOpenForm(p.id); setNameDraft(""); setIdDraft(""); }}><MarketingIcon name="link" size={13} /> Connect</button>
                  </div>
                )}

                {openForm === p.id && (
                  <div className="conn-form">
                    <label className="mini"><span>Account name</span>
                      <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="e.g. Acme Ltd" autoFocus />
                    </label>
                    <label className="mini"><span>Account ID <em>(optional)</em></span>
                      <input value={idDraft} onChange={(e) => setIdDraft(e.target.value)} placeholder="Add it now, or paste it in later" />
                    </label>
                    <p className="cx-form-hint">Just a label so you can tell accounts apart in ONEVYRT — it doesn&apos;t change anything on {p.name} itself.</p>
                    <div className="prov-actions">
                      <button className="btn primary sm" onClick={() => void connect(p.id)} disabled={busy === p.id}>{busy === p.id ? "Saving…" : "Save"}</button>
                      <button className="btn ghost sm" onClick={() => { setOpenForm(null); setNameDraft(""); setIdDraft(""); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Connections, migrated onto ONEVYRT Design System v1 tokens (app/design-system.css)
// so it reads as the same product as its siblings (Brand Brain, Creative
// Studio). Local aliases map onto --ds-* rather than hardcoded hex, so this
// renders correctly in both the light theme and the navy-blue-grey dark theme
// with no separate per-page dark override block needed. Colour is used with
// intent: brand green = primary action / AI, success green = "linked and
// working", info blue = neutral explanation, danger red = destructive,
// warning amber = a gate you can't get past yet.
const CSS = `
.cx-root{--surface:var(--ds-surface);--panel:var(--ds-bg-subtle);--accent:var(--ds-brand-solid);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:960px;margin:0 auto;padding:26px 18px 100px;color:var(--text);font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.cx-root *{box-sizing:border-box;}
.cx-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.cx-header h1{font-size:24px;font-weight:700;margin:2px 0 3px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:1px;font-weight:700;text-transform:uppercase;color:var(--ds-text-tertiary);}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:62ch;line-height:1.55;}
.header-right{display:flex;gap:8px;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:10px;padding:8px 13px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,transform .15s,box-shadow .15s;}
.btn:hover:not(:disabled){border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);}
.btn:active:not(:disabled){transform:translateY(0);box-shadow:none;}
.btn:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.btn:disabled{opacity:.55;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover:not(:disabled){background:var(--ds-bg-subtle);color:var(--text);box-shadow:none;}
.btn.sm{padding:6px 11px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:var(--ds-brand-contrast);box-shadow:inset 0 1px 0 rgba(255,255,255,.16);}
.btn.primary:hover:not(:disabled){background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.btn.primary:active:not(:disabled){background:var(--ds-brand-active);border-color:var(--ds-brand-active);}
.btn.danger{color:var(--ds-danger);}
.btn.danger:hover:not(:disabled){background:var(--ds-danger-soft);border-color:var(--ds-danger);color:var(--ds-danger);}
.link{background:none;border:none;color:var(--ds-brand);cursor:pointer;padding:0;font:inherit;transition:color .15s;}
.link:hover{color:var(--ds-brand-hover);text-decoration:underline;}
.link:focus-visible{outline:none;box-shadow:var(--ds-ring);border-radius:3px;}
.msg{display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:10px;font-size:13px;margin-bottom:14px;font-weight:500;border-left:3px solid transparent;}
.msg svg{flex:0 0 auto;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);border-left-color:var(--ds-success);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);border-left-color:var(--ds-danger);}
.callout{display:flex;gap:11px;align-items:flex-start;background:var(--ds-info-soft);border:1px solid var(--ds-border-subtle);border-radius:12px;padding:13px 16px;font-size:13px;margin-bottom:18px;line-height:1.5;}
.callout-ic{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--ds-surface);color:var(--ds-info);flex:0 0 auto;margin-top:1px;}
.callout b{display:block;margin-bottom:3px;color:var(--ds-info);font-size:13px;}
.callout p{margin:0;color:var(--text);}
.callout em{font-style:normal;font-weight:700;color:var(--ds-brand-active);}
.ai-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;margin-bottom:16px;box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s;}
.ai-card:hover{box-shadow:var(--ds-shadow-sm);}
.ai-card-head{display:flex;align-items:flex-start;gap:11px;margin-bottom:14px;}
.ai-card-head h2{margin:0;font-size:16px;}
.ai-card-head .sub{margin:3px 0 0;}
.cx-sec-icon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;flex:0 0 auto;margin-top:1px;}
.cx-sec-icon.sm{width:20px;height:20px;border-radius:6px;margin-top:0;}
.sec-title{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);margin:4px 0 4px;}
.cx-sec-why{font-size:12.5px;line-height:1.5;color:var(--muted);margin:0 0 12px;max-width:64ch;}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:22px;}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;text-align:center;gap:2px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:13px;}
@keyframes cx-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.prov-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:15px 16px;display:flex;flex-direction:column;gap:11px;box-shadow:var(--ds-shadow-xs);transition:transform .15s,box-shadow .15s,border-color .15s;animation:cx-in .3s ease both;}
.prov-card:hover{transform:translateY(-2px);box-shadow:var(--ds-shadow-md);}
.prov-card.connected{border-color:var(--ds-success);box-shadow:0 0 0 1px var(--ds-success);}
.prov-card.connected:hover{box-shadow:0 0 0 1px var(--ds-success),var(--ds-shadow-md);}
.prov-top{display:flex;align-items:center;gap:11px;}
.prov-ic{width:40px;height:40px;border-radius:11px;border:1.5px solid;display:grid;place-items:center;font-size:20px;flex:none;}
.prov-meta{flex:1;min-width:0;}
.prov-name{font-size:13.5px;font-weight:700;line-height:1.2;}
.kind{display:inline-block;font-size:10.5px;font-weight:700;color:var(--ds-text-tertiary);letter-spacing:.3px;text-transform:uppercase;margin-top:2px;}
.kind-ai{color:var(--ds-brand-active);}
.kind-adssocial{color:var(--ds-info);}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;}
.chip.ok{background:var(--ds-success-soft);color:var(--ds-success);}
.chip.off{background:var(--ds-bg-subtle);color:var(--ds-text-tertiary);}
.prov-body{display:flex;flex-direction:column;gap:9px;}
.note{font-size:12px;color:var(--muted);margin:0;line-height:1.45;}
.acc{font-size:13px;}.acc-id{color:var(--muted);}
.prov-actions{display:flex;gap:7px;flex-wrap:wrap;}
.conn-form{display:flex;flex-direction:column;gap:9px;border-top:1px dashed var(--border);padding-top:11px;animation:cx-in .2s ease both;}
.mini{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:500;color:var(--muted);}
.mini em{font-style:normal;font-weight:500;color:var(--ds-text-tertiary);}
.mini select,.mini input{font:inherit;font-size:13.5px;color:var(--text);background:var(--surface);border:1px solid var(--border-strong);border-radius:9px;padding:8px 10px;width:100%;transition:border-color .15s,box-shadow .15s;}
.mini select:hover,.mini input:hover{border-color:var(--ds-border-strong);}
.mini select:focus,.mini input:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.cx-form-hint{font-size:11.5px;color:var(--ds-text-tertiary);margin:0;line-height:1.45;}
.spinner{width:26px;height:26px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:10px;}
@keyframes spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion: reduce){ * { transition:none!important; animation:none!important } }
`;
