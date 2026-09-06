"use client";
/**
 * OtoCard — the one-time-offer upsell. Self-contained and safe by default: it
 * fetches /api/billing/oto and renders NOTHING unless the server has an OTO
 * configured AND this workspace doesn't already own it. So on any surface it's
 * dropped onto, it's invisible until an operator turns the offer on — it can
 * never show a broken or empty card. Accepting redirects to Stripe-hosted
 * checkout; the entitlement is granted later by the isolated OTO webhook once
 * payment clears, never here.
 */
import { useEffect, useState } from "react";

interface OtoOffer { name: string; description: string; priceLabel: string; }

export function OtoCard({ ws }: { ws?: string }) {
  const [offer, setOffer] = useState<OtoOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    const q = ws ? `?ws=${encodeURIComponent(ws)}` : "";
    fetch(`/api/billing/oto${q}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { configured?: boolean; alreadyOwned?: boolean; isOwner?: boolean; offer?: OtoOffer } | null) => {
        if (live && d?.configured && !d.alreadyOwned && d.isOwner && d.offer) setOffer(d.offer);
      })
      .catch(() => { /* offer stays hidden */ });
    return () => { live = false; };
  }, [ws]);

  if (!offer) return null;

  const buy = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/billing/oto", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ws ? { ws } : {}),
      });
      const d = await r.json() as { url?: string; error?: string };
      if (!r.ok || !d.url) { setErr(d.error || "Couldn't start checkout — try again."); setBusy(false); return; }
      window.location.assign(d.url);
    } catch { setErr("Network error — try again."); setBusy(false); }
  };

  return (
    <div className="oto-card">
      <style>{CSS}</style>
      <div className="oto-tag">One-time offer</div>
      <div className="oto-name">{offer.name}</div>
      <p className="oto-desc">{offer.description}</p>
      {err && <div className="oto-err">{err}</div>}
      <button className="oto-btn" disabled={busy} onClick={() => void buy()}>
        {busy ? "Starting checkout…" : `Get it — ${offer.priceLabel}`}
      </button>
    </div>
  );
}

const CSS = `
.oto-card { border: 1px solid color-mix(in srgb, var(--ds-brand, #088057) 34%, transparent); background: var(--ds-brand-soft, #e7f6f0);
  border-radius: var(--ds-radius-lg, 14px); padding: 16px 18px; margin: 12px 0; display: flex; flex-direction: column; gap: 6px; }
.oto-tag { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ds-brand-active, #088057); }
.oto-name { font-size: 16px; font-weight: 800; color: var(--ds-text-primary, #111827); }
.oto-desc { font-size: 13px; line-height: 1.55; color: var(--ds-text-secondary, #475569); margin: 0; }
.oto-err { font-size: 12.5px; color: var(--ds-danger, #dc2626); }
.oto-btn { align-self: flex-start; margin-top: 6px; font: inherit; font-size: 13.5px; font-weight: 700; border: none; cursor: pointer;
  border-radius: 10px; padding: 9px 16px; color: #fff; background: var(--ds-brand-solid, #088057); }
.oto-btn:disabled { opacity: .6; cursor: default; }
.oto-btn:focus-visible { outline: 2px solid var(--ds-brand, #088057); outline-offset: 2px; }
`;
