/**
 * ConnectPayments — the Stripe Connect onboarding card (#55, 3/3).
 *
 * Lets a workspace owner connect their own Stripe account so their funnels can
 * collect payments from THEIR customers. Card data always lives in Stripe's
 * hosted onboarding — this UI only ever kicks off onboarding and reflects the
 * account's status. Self-scoped styles ("cp-" prefix) so it drops onto any page.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "./Toast";

type Status = "loading" | "unconfigured" | "none" | "onboarding" | "restricted" | "active" | "error";

const COPY: Record<Exclude<Status, "loading">, { badge: string; tone: string; line: string; cta: string | null }> = {
  unconfigured: { badge: "Not available", tone: "muted", line: "Payments aren't enabled on this server yet. An admin sets the Stripe keys.", cta: null },
  none: { badge: "Not connected", tone: "muted", line: "Connect a Stripe account to collect payments from your customers through your funnels.", cta: "Connect payments" },
  onboarding: { badge: "In progress", tone: "warn", line: "Stripe still needs a few details before you can take payments.", cta: "Finish setup" },
  restricted: { badge: "Action needed", tone: "warn", line: "Stripe needs more information to verify your account before payouts start.", cta: "Resolve on Stripe" },
  active: { badge: "Active", tone: "good", line: "You're all set — your funnels can collect payments and Stripe pays out to your account.", cta: "Manage on Stripe" },
  error: { badge: "Error", tone: "warn", line: "Couldn't reach Stripe just now. Try again in a moment.", cta: "Retry" },
};

export default function ConnectPayments() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/billing/connect/status", { credentials: "include" });
      if (r.status === 401) { setStatus("none"); return; }
      const d = await r.json().catch(() => ({}));
      if (d?.configured === false) { setStatus("unconfigured"); return; }
      const s = d?.status as string | undefined;
      setStatus(s === "onboarding" || s === "restricted" || s === "active" || s === "none" ? s : "none");
    } catch { setStatus("error"); }
  }, []);
  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/billing/connect/start", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.url) { toast(d?.error || "Couldn't start Stripe onboarding.", "error"); setBusy(false); return; }
      window.location.href = d.url as string; // hand off to Stripe's hosted onboarding
    } catch { toast("Network error — please try again.", "error"); setBusy(false); }
  };

  if (status === "loading") return <section className="cp cp-skel" aria-hidden><style>{CSS}</style></section>;

  const c = COPY[status];
  return (
    <section className="cp" aria-label="Collect payments">
      <style>{CSS}</style>
      <div className="cp-head">
        <span className="cp-ic">💳</span>
        <div className="cp-titles">
          <div className="cp-title">Get paid through your funnels</div>
          <div className="cp-sub">Powered by Stripe — cards are handled by Stripe, never stored by OneVYRT.</div>
        </div>
        <span className={`cp-badge ${c.tone}`}>{c.badge}</span>
      </div>
      <p className="cp-line">{c.line}</p>
      {c.cta && (
        <button className="cp-btn" disabled={busy} onClick={() => (status === "error" ? void loadStatus() : void start())}>
          {busy ? "Opening Stripe…" : c.cta}
        </button>
      )}
    </section>
  );
}

const CSS = `
.cp{--cp-brand:var(--ds-brand,#0a9e6e);background:var(--ds-surface,#fff);border:1px solid var(--ds-border-default,#dde3eb);border-radius:var(--ds-radius-lg,12px);padding:16px 18px;box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.04));margin:14px 0;}
.cp.cp-skel{height:120px;}
.cp *{box-sizing:border-box;}
.cp-head{display:flex;align-items:flex-start;gap:12px;}
.cp-ic{font-size:22px;line-height:1;}
.cp-titles{flex:1;min-width:0;}
.cp-title{font-size:15px;font-weight:700;color:var(--ds-text-primary,#111827);}
.cp-sub{font-size:12px;color:var(--ds-text-tertiary,#64748b);margin-top:2px;line-height:1.5;}
.cp-badge{flex:0 0 auto;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:3px 10px;border-radius:999px;}
.cp-badge.good{background:var(--ds-success-soft,#ecfdf3);color:var(--ds-success,#15803d);}
.cp-badge.warn{background:#fff7ed;color:#b45309;}
.cp-badge.muted{background:var(--ds-surface-subtle,#f1f5f9);color:var(--ds-text-tertiary,#64748b);}
.cp-line{font-size:13px;color:var(--ds-text-secondary,#475569);line-height:1.55;margin:12px 0 0;max-width:64ch;}
.cp-btn{margin-top:12px;background:var(--cp-brand);color:#fff;border:none;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s;}
.cp-btn:hover{opacity:.9;}
.cp-btn:disabled{opacity:.6;cursor:default;}
`;
