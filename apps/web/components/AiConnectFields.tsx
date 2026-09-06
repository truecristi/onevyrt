"use client";
/**
 * The one AI-connection control the Business OS steps share: a provider
 * dropdown (OpenAI / Claude / Grok / OpenRouter / manual) plus the key + model
 * fields and a "Test" button. Reads and writes the single shared connection
 * (lib/ai/client), so a provider/key chosen on any screen applies everywhere.
 * The key is saved to the workspace (encrypted server-side) so it persists
 * across devices and restarts; the AI request still goes straight from the
 * browser to the provider. `onChange` lets the host page keep its own
 * aiKey/aiModel mirror in sync for its callOpenRouter() calls.
 *
 * Styled with the design-system classes these pages already use (.mini,
 * .btn.ghost.sm) so it drops straight into their ⚙ AI panels.
 */
import { useEffect, useState } from "react";
import { AI_PROVIDERS, getAIProvider, type AIProviderId } from "../lib/ai/providers";
import { loadConnection, saveConnection, testConnection, type AIConnection } from "../lib/ai/client";

export function AiConnectFields({ onChange }: { onChange?: (conn: AIConnection) => void }) {
  const [conn, setConn] = useState<AIConnection>(() => loadConnection() ?? { provider: "openrouter", apiKey: "", model: "" });
  const [test, setTest] = useState<{ s: "idle" | "testing" | "ok" | "err"; m?: string }>({ s: "idle" });
  // Managed-AI allowance, shown when the owner has enabled managed AI and the
  // user hasn't added their own key — so they know the AI works out of the box
  // and how much of the free monthly quota is left.
  const [managed, setManaged] = useState<{ configured: boolean; used: number; quota: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/ai/generate", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d && typeof d.configured === "boolean") setManaged(d); })
      .catch(() => { /* non-critical */ });
    return () => { live = false; };
  }, []);
  const prov = getAIProvider(conn.provider);

  const update = (patch: Partial<AIConnection>) => {
    const next = { ...conn, ...patch };
    setConn(next);
    saveConnection(next);
    onChange?.(next);
    setTest({ s: "idle" }); // any change invalidates a prior ✓/✗
  };
  const doTest = async () => {
    setTest({ s: "testing" });
    const r = await testConnection(conn);
    setTest(r.ok ? { s: "ok" } : { s: "err", m: r.error });
  };

  return (
    <>
      {managed?.configured && !conn.apiKey.trim() && (
        <div style={{ fontSize: 12, lineHeight: 1.5, background: "var(--ds-brand-soft, #e7f6f0)", border: "1px solid var(--ds-brand, #0a9e6e)", borderRadius: 9, padding: "8px 11px", marginBottom: 10, color: "var(--ds-text-primary, #111827)" }}>
          <b>AI is ready to use</b> — {Math.max(0, managed.quota - managed.used)} of {managed.quota} free generations left this month. Add your own key below for unlimited use.
        </div>
      )}
      <label className="mini">
        <span>AI provider</span>
        <select value={conn.provider} onChange={(e) => update({ provider: e.target.value as AIProviderId })}>
          {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
        </select>
      </label>
      {conn.provider !== "manual" && (
        <>
          <label className="mini">
            <span>{prov?.name ?? "Provider"} API key (saved to your account, sent straight to the provider)</span>
            <input type="password" value={conn.apiKey} autoComplete="off"
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={prov?.keyPrefix ? `${prov.keyPrefix}…` : "your API key"} />
          </label>
          <label className="mini">
            <span>Model</span>
            <input value={conn.model} onChange={(e) => update({ model: e.target.value })} placeholder={prov?.defaultModel || "model id"} />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
            <button type="button" className="btn ghost sm" onClick={doTest} disabled={test.s === "testing"}>
              {test.s === "testing" ? "Testing…" : "Test connection"}
            </button>
            {conn.apiKey.trim() && (
              <button type="button" className="btn ghost sm" onClick={() => update({ apiKey: "" })} title="Remove your saved key">Remove key</button>
            )}
            {test.s === "ok" && <span style={{ fontSize: 11.5, color: "#087f57", fontWeight: 500 }}>✓ Works</span>}
            {test.s === "err" && <span style={{ fontSize: 11.5, color: "#c0392b" }}>✗ {test.m}</span>}
            {test.s === "idle" && conn.apiKey.trim() && <span style={{ fontSize: 11.5, color: "var(--ds-text-tertiary, #64748b)" }}>✓ Saved to your account</span>}
          </div>
          {prov?.keyUrl && (
            <div style={{ fontSize: 11, marginTop: 4 }}>
              <a href={prov.keyUrl} target="_blank" rel="noreferrer" style={{ color: "var(--ds-brand, #0a9e6e)" }}>Get a {prov.name} key →</a>
            </div>
          )}
        </>
      )}
    </>
  );
}
