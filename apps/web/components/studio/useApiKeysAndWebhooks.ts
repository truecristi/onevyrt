/**
 * Developer-settings slice of the Studio's Integrations panel — API keys and
 * outbound webhooks (with the per-webhook delivery log). Extracted from
 * funnel-studio.tsx as a self-contained hook: it depends only on the active
 * workspace query (`wsQuery`) and whether the Integrations panel is open, owns
 * its own ~12 pieces of state, and returns everything the panel's JSX reads.
 * Pulling it out of the 4,000-line monolith removes a whole feature's state and
 * handlers without any prop-drilling — the component just calls the hook.
 */
import { useCallback, useEffect, useState } from "react";
import { confirmDialog } from "../Modal";

export type WHDelivery = { id: string; event: string; status?: number; ok: boolean; error?: string; at: string };

export interface ApiKey { id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string; revoked?: boolean }
export interface Webhook { id: string; url: string; events: string[]; createdAt: string; lastDeliveryAt?: string; lastStatus?: number; lastError?: string; disabled?: boolean }

export function useApiKeysAndWebhooks(wsQuery: string, integrationsOpen: boolean) {
  const [apiKeys, setApiKeys] = useState<ApiKey[] | null>(null);
  const [apiKeyNameInput, setApiKeyNameInput] = useState("");
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyErr, setApiKeyErr] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookEventsInput, setWebhookEventsInput] = useState<string[]>(["project.created"]);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookErr, setWebhookErr] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  // Delivery-log panel: which webhook's log is expanded, and the fetched rows
  // per webhook ("loading" while in flight). Lazy — only fetched when opened.
  const [openWebhookLog, setOpenWebhookLog] = useState<string | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<Record<string, WHDelivery[] | "loading">>({});

  const refreshApiKeys = useCallback(async () => {
    try {
      const r = await fetch(`/api/settings/api-keys${wsQuery}`);
      if (r.ok) setApiKeys(await r.json());
    } catch { /* offline: panel just stays loading */ }
  }, [wsQuery]);
  const createApiKeyClick = useCallback(async () => {
    setApiKeyBusy(true); setApiKeyErr(""); setNewApiKey("");
    try {
      const r = await fetch(`/api/settings/api-keys${wsQuery}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: apiKeyNameInput.trim() || "Untitled key" }),
      });
      const data = await r.json() as { key?: string; error?: string };
      if (!r.ok) { setApiKeyErr(data.error ?? `Request failed (${r.status}).`); return; }
      setNewApiKey(data.key ?? ""); setApiKeyNameInput("");
      await refreshApiKeys();
    } catch (e) {
      setApiKeyErr(e instanceof Error ? e.message : "Network error.");
    } finally { setApiKeyBusy(false); }
  }, [wsQuery, apiKeyNameInput, refreshApiKeys]);
  const revokeApiKeyClick = useCallback(async (id: string) => {
    // Revoking a key breaks any live integration using it, so confirm — and
    // never fail silently: a key the owner thinks is revoked staying live is a
    // security problem, so surface any failure instead of swallowing it.
    if (!(await confirmDialog({ title: "Revoke this API key?", message: "Anything using it stops working immediately. This can't be undone.", danger: true, confirmLabel: "Revoke" }))) return;
    setApiKeyErr("");
    try {
      const r = await fetch(`/api/settings/api-keys/${encodeURIComponent(id)}${wsQuery}`, { method: "DELETE" });
      if (!r.ok) { setApiKeyErr(`Couldn't revoke the key (${r.status}). It may still be active — try again.`); return; }
      await refreshApiKeys();
    } catch { setApiKeyErr("Network error — the key may still be active. Try again."); }
  }, [wsQuery, refreshApiKeys]);
  useEffect(() => { if (integrationsOpen) { setNewApiKey(""); void refreshApiKeys(); } }, [integrationsOpen, refreshApiKeys]);

  const refreshWebhooks = useCallback(async () => {
    try {
      const r = await fetch(`/api/settings/webhooks${wsQuery}`);
      if (r.ok) setWebhooks(await r.json());
    } catch { /* offline: panel just stays loading */ }
  }, [wsQuery]);
  const toggleWebhookLog = useCallback(async (id: string) => {
    // Collapse if already open; otherwise open and (re)fetch this hook's log.
    if (openWebhookLog === id) { setOpenWebhookLog(null); return; }
    setOpenWebhookLog(id);
    setWebhookLogs((m) => ({ ...m, [id]: "loading" }));
    try {
      const r = await fetch(`/api/settings/webhooks/${id}/deliveries${wsQuery}`);
      const rows: WHDelivery[] = r.ok ? await r.json() : [];
      setWebhookLogs((m) => ({ ...m, [id]: rows }));
    } catch { setWebhookLogs((m) => ({ ...m, [id]: [] })); }
  }, [openWebhookLog, wsQuery]);
  const createWebhookClick = useCallback(async () => {
    setWebhookBusy(true); setWebhookErr(""); setNewWebhookSecret("");
    try {
      const r = await fetch(`/api/settings/webhooks${wsQuery}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: webhookUrlInput.trim(), events: webhookEventsInput }),
      });
      const data = await r.json() as { secret?: string; error?: string };
      if (!r.ok) { setWebhookErr(data.error ?? `Request failed (${r.status}).`); return; }
      setNewWebhookSecret(data.secret ?? ""); setWebhookUrlInput("");
      await refreshWebhooks();
    } catch (e) {
      setWebhookErr(e instanceof Error ? e.message : "Network error.");
    } finally { setWebhookBusy(false); }
  }, [wsQuery, webhookUrlInput, webhookEventsInput, refreshWebhooks]);
  const deleteWebhookClick = useCallback(async (id: string) => {
    if (!(await confirmDialog({ title: "Delete this webhook?", message: "Events will stop being delivered to it. This can't be undone.", danger: true, confirmLabel: "Delete" }))) return;
    setWebhookErr("");
    try {
      const r = await fetch(`/api/settings/webhooks/${encodeURIComponent(id)}${wsQuery}`, { method: "DELETE" });
      if (!r.ok) { setWebhookErr(`Couldn't delete the webhook (${r.status}). Try again.`); return; }
      await refreshWebhooks();
    } catch { setWebhookErr("Network error — try again."); }
  }, [wsQuery, refreshWebhooks]);
  useEffect(() => { if (integrationsOpen) { setNewWebhookSecret(""); void refreshWebhooks(); } }, [integrationsOpen, refreshWebhooks]);

  return {
    apiKeys, apiKeyNameInput, setApiKeyNameInput, apiKeyBusy, apiKeyErr, newApiKey,
    createApiKeyClick, revokeApiKeyClick,
    webhooks, webhookUrlInput, setWebhookUrlInput, webhookEventsInput, setWebhookEventsInput,
    webhookBusy, webhookErr, newWebhookSecret, openWebhookLog, webhookLogs,
    toggleWebhookLog, createWebhookClick, deleteWebhookClick,
  };
}
