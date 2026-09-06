"use client";

import { useState, useEffect, useRef } from "react";
import { ACCENT, barGhost, barPrimary } from "../lib/studio-ui";
import { useDialogA11y } from "../lib/use-dialog-a11y";
import { loadStripeJs, formatCents, type StripeJs, type StripeElement, type StripeElements } from "../lib/stripe-loader";
import { OtoCard } from "./OtoCard";

const PLAN_TIERS: { id: string; name: string; price: string; features: string[] }[] = [
  { id: "free", name: "Free", price: "£0/mo", features: ["Read-only demo project", "See every feature filled in", "No projects of your own"] },
  { id: "pro", name: "Pro", price: "£79/mo", features: ["1 profile", "Unlimited projects", "Full program (Freedom Plan, Profit Levers, Client Advocacy)", "Reports & export", "Scenarios & Goal Solver"] },
  { id: "business", name: "Business", price: "£149/mo", features: ["Everything in Pro", "Multiple profiles — invite your team", "Advanced reports", "Priority support"] },
  { id: "performance", name: "Performance", price: "Contact us", features: ["Everything in Business", "ACTUAL tracking & Explorer", "Real people journeys", "Variance analysis"] },
];
const SELF_SERVE_PLANS = new Set(["pro", "business"]);

// Stripe.js loader + types live in lib/stripe-loader (shared with the public
// funnel's paid step) so there's a single Window.Stripe global augmentation.

interface ActiveSubscription { id: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number; priceId: string | null; }
interface InvoiceSummary { id: string; amountPaid: number; currency: string; status: string; created: number; pdfUrl: string | null; }

interface PayStep { plan: string; clientSecret: string; publishableKey: string }

// Plan comparison UI. Upgrading a self-serve plan collects payment with an
// embedded Stripe Elements form (see PayStep below) — card fields are a
// Stripe-hosted iframe, so raw card data never reaches this app's own code,
// only Stripe's. "performance" stays contact-sales; "free" is a downgrade
// note, not a checkout.
export function SubscriptionModal({ onClose, activeWsId }: { onClose: () => void; activeWsId: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);
  const [requestMsg, setRequestMsg] = useState("");
  const [checkoutErr, setCheckoutErr] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [hasBillingHistory, setHasBillingHistory] = useState(false);
  const [payStep, setPayStep] = useState<PayStep | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [payDone, setPayDone] = useState(false);
  const stripeRef = useRef<StripeJs | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);

  // "Manage subscription" — invoices, payment method, cancel/resume — all
  // in-page instead of Stripe's hosted billing portal. Separate Stripe
  // Elements mount (cardStep) from the upgrade flow's payStep above, since
  // a SetupIntent (no charge) and a PaymentIntent (a real charge) are
  // different Stripe objects even though both use the Payment Element.
  const [manageOpen, setManageOpen] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageErr, setManageErr] = useState("");
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cardStep, setCardStep] = useState<{ clientSecret: string; publishableKey: string } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardErr, setCardErr] = useState("");
  const [cardDone, setCardDone] = useState(false);
  const cardStripeRef = useRef<StripeJs | null>(null);
  const cardElementsRef = useRef<StripeElements | null>(null);
  const cardMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/workspaces/${encodeURIComponent(activeWsId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((ws: { plan?: string; stripeCustomerId?: string } | null) => {
        if (!live || !ws) return;
        setCurrentPlan(ws.plan ?? "free");
        setHasBillingHistory(!!ws.stripeCustomerId);
      })
      .catch(() => { /* default to free */ });
    return () => { live = false; };
  }, [activeWsId]);

  // Mounts the embedded card form the moment a subscribe attempt hands back
  // a clientSecret. Torn down on unmount/step-change so a second attempt
  // (e.g. after a card error) gets a clean element instead of stacking two.
  useEffect(() => {
    if (!payStep) return;
    let cancelled = false;
    let element: StripeElement | null = null;
    void loadStripeJs().then(() => {
      if (cancelled || !window.Stripe || !mountRef.current) return;
      const stripe = window.Stripe(payStep.publishableKey);
      const elements = stripe.elements({ clientSecret: payStep.clientSecret });
      element = elements.create("payment");
      element.mount(mountRef.current);
      stripeRef.current = stripe;
      elementsRef.current = elements;
    }).catch(() => setPayErr("Could not load the payment form. Try again shortly."));
    return () => { cancelled = true; element?.unmount(); stripeRef.current = null; elementsRef.current = null; };
  }, [payStep]);

  // Same mount pattern as payStep above, for the "update payment method"
  // SetupIntent form — a separate element/ref pair since the two forms can
  // never be open at the same time but are logically distinct Stripe objects.
  useEffect(() => {
    if (!cardStep) return;
    let cancelled = false;
    let element: StripeElement | null = null;
    void loadStripeJs().then(() => {
      if (cancelled || !window.Stripe || !cardMountRef.current) return;
      const stripe = window.Stripe(cardStep.publishableKey);
      const elements = stripe.elements({ clientSecret: cardStep.clientSecret });
      element = elements.create("payment");
      element.mount(cardMountRef.current);
      cardStripeRef.current = stripe;
      cardElementsRef.current = elements;
    }).catch(() => setCardErr("Could not load the card form. Try again shortly."));
    return () => { cancelled = true; element?.unmount(); cardStripeRef.current = null; cardElementsRef.current = null; };
  }, [cardStep]);

  const startCheckout = async (planId: string) => {
    if (checkoutBusy) return;
    setCheckoutBusy(planId); setCheckoutErr(""); setPayErr(""); setPayDone(false);
    try {
      const r = await fetch("/api/billing/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: planId, ws: activeWsId }) });
      const data = await r.json() as { clientSecret?: string; publishableKey?: string; error?: string };
      if (!r.ok || !data.clientSecret || !data.publishableKey) { setCheckoutErr(data.error ?? "Could not start checkout."); setCheckoutBusy(null); return; }
      setPayStep({ plan: planId, clientSecret: data.clientSecret, publishableKey: data.publishableKey });
    } catch { setCheckoutErr("Network error — is the app reachable?"); }
    setCheckoutBusy(null);
  };

  const confirmPay = async () => {
    if (!stripeRef.current || !elementsRef.current || payBusy) return;
    setPayBusy(true); setPayErr("");
    try {
      // A network hiccup mid-confirm makes confirmPayment THROW (not merely
      // return an { error }); without this catch the throw escapes, payBusy is
      // never cleared, and the modal jams on "Processing…" with Close disabled
      // and no way to retry. Mirror the public funnel's checkout: surface a
      // recoverable error and let the user try again or close. The finally
      // clears payBusy on every exit path (throw, card error, success, timeout).
      const result = await stripeRef.current.confirmPayment({ elements: elementsRef.current, redirect: "if_required" });
      if (result.error) { setPayErr(result.error.message ?? "Payment failed."); return; }
      // Stripe confirmed the charge; the workspace's plan flips via the
      // customer.subscription.updated webhook, which can take a couple of
      // seconds. Poll briefly instead of claiming success before it's true.
      const plan = payStep?.plan;
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          const r = await fetch(`/api/workspaces/${encodeURIComponent(activeWsId)}`);
          const ws = r.ok ? await r.json() as { plan?: string } : null;
          if (ws?.plan && ws.plan === plan) { setCurrentPlan(ws.plan); setPayDone(true); setPayStep(null); return; }
        } catch { /* keep polling */ }
      }
      setPayErr("Payment succeeded, but activation is taking longer than expected — refresh in a moment.");
    } catch {
      setPayErr("The payment couldn't be completed — please try again.");
    } finally {
      setPayBusy(false);
    }
  };

  const loadBillingStatus = async () => {
    setManageLoading(true); setManageErr("");
    try {
      const r = await fetch("/api/billing/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: activeWsId }) });
      const data = await r.json() as { plan?: string; subscription?: ActiveSubscription | null; invoices?: InvoiceSummary[]; error?: string };
      if (!r.ok) { setManageErr(data.error ?? "Could not load billing status."); setManageLoading(false); return; }
      if (data.plan) setCurrentPlan(data.plan);
      setSubscription(data.subscription ?? null);
      setInvoices(data.invoices ?? []);
    } catch { setManageErr("Network error — is the app reachable?"); }
    setManageLoading(false);
  };

  const openManage = () => { setManageOpen(true); void loadBillingStatus(); };

  const toggleCancel = async (cancel: boolean) => {
    if (cancelBusy) return;
    setCancelBusy(true); setManageErr("");
    try {
      const r = await fetch(cancel ? "/api/billing/cancel" : "/api/billing/resume", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: activeWsId }) });
      const data = await r.json() as { cancelAtPeriodEnd?: boolean; currentPeriodEnd?: number; error?: string };
      if (!r.ok) { setManageErr(data.error ?? "Could not update the subscription."); setCancelBusy(false); return; }
      setSubscription((s) => (s ? { ...s, cancelAtPeriodEnd: !!data.cancelAtPeriodEnd, currentPeriodEnd: data.currentPeriodEnd ?? s.currentPeriodEnd } : s));
    } catch { setManageErr("Network error — is the app reachable?"); }
    setCancelBusy(false);
  };

  const startUpdateCard = async () => {
    if (cardBusy) return;
    setCardBusy(true); setCardErr(""); setCardDone(false);
    try {
      const r = await fetch("/api/billing/setup-intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: activeWsId }) });
      const data = await r.json() as { clientSecret?: string; publishableKey?: string; error?: string };
      if (!r.ok || !data.clientSecret || !data.publishableKey) { setCardErr(data.error ?? "Could not start card update."); setCardBusy(false); return; }
      setCardStep({ clientSecret: data.clientSecret, publishableKey: data.publishableKey });
    } catch { setCardErr("Network error — is the app reachable?"); }
    setCardBusy(false);
  };

  const confirmCard = async () => {
    if (!cardStripeRef.current || !cardElementsRef.current || cardBusy) return;
    setCardBusy(true); setCardErr("");
    const result = await cardStripeRef.current.confirmSetup({ elements: cardElementsRef.current, redirect: "if_required" });
    if (result.error) { setCardErr(result.error.message ?? "Could not save the card."); setCardBusy(false); return; }
    const pmId = result.setupIntent?.payment_method;
    if (pmId) {
      try {
        await fetch("/api/billing/set-default-payment-method", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: activeWsId, paymentMethodId: pmId }) });
      } catch { /* card is attached either way; default-setting is best-effort */ }
    }
    setCardBusy(false); setCardDone(true); setCardStep(null);
  };

  return (
    <div onClick={() => { if (!payBusy && !cardBusy) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Subscription" onClick={(e) => e.stopPropagation()} style={{ width: "min(820px, 100%)", maxHeight: "86vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, boxShadow: "var(--shadow-panel)" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: ACCENT, fontWeight: 700 }}>SUBSCRIPTION</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{payStep ? `Upgrade to ${payStep.plan === "pro" ? "Pro" : "Business"}` : manageOpen ? "Manage subscription" : "Plans"}</div>
          </div>
          <button onClick={onClose} disabled={payBusy || cardBusy} style={{ ...barGhost, opacity: (payBusy || cardBusy) ? 0.5 : 1 }}>Close</button>
        </div>
        {manageOpen ? (
          <div style={{ padding: 22 }}>
            <button onClick={() => { setManageOpen(false); setCardStep(null); setCardErr(""); setCardDone(false); }} disabled={cardBusy} style={{ ...barGhost, marginBottom: 16, opacity: cardBusy ? 0.5 : 1 }}>← Back to plans</button>
            {manageLoading ? (
              <div style={{ fontSize: 13, color: "var(--dim)" }}>Loading billing status…</div>
            ) : manageErr ? (
              <div style={{ fontSize: 12, color: "#dc2626", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12 }}>{manageErr}</div>
            ) : (
              <>
                <div style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, background: "var(--surface2)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", marginBottom: 4 }}>{currentPlan} plan{subscription ? ` · ${subscription.status}` : ""}</div>
                  {subscription ? (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {subscription.cancelAtPeriodEnd
                        ? `Cancels on ${new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()} — you'll keep access until then.`
                        : `Renews on ${new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}.`}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>No active subscription.</div>
                  )}
                  {subscription && (
                    <button onClick={() => void toggleCancel(!subscription.cancelAtPeriodEnd)} disabled={cancelBusy}
                      style={{ ...barGhost, marginTop: 10, opacity: cancelBusy ? 0.6 : 1, color: subscription.cancelAtPeriodEnd ? undefined : "#dc2626" }}>
                      {cancelBusy ? "Working…" : subscription.cancelAtPeriodEnd ? "Keep subscription" : "Cancel subscription"}
                    </button>
                  )}
                </div>

                <div style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, background: "var(--surface2)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Payment method</div>
                  {cardDone && <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 10 }}>Card saved and set as default.</div>}
                  {cardStep ? (
                    <>
                      <div ref={cardMountRef} style={{ marginBottom: 12 }} />
                      {cardErr && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{cardErr}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => void confirmCard()} disabled={cardBusy} style={{ ...barPrimary, opacity: cardBusy ? 0.6 : 1 }}>{cardBusy ? "Saving…" : "Save card"}</button>
                        <button onClick={() => { setCardStep(null); setCardErr(""); }} disabled={cardBusy} style={{ ...barGhost, opacity: cardBusy ? 0.5 : 1 }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => void startUpdateCard()} disabled={cardBusy} style={{ ...barGhost, opacity: cardBusy ? 0.6 : 1 }}>{cardBusy ? "Starting…" : "Update payment method"}</button>
                  )}
                </div>

                <div style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Invoice history</div>
                  {invoices.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--dim)" }}>No invoices yet.</div>
                  ) : (
                    invoices.map((inv) => (
                      <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
                        <span>{new Date(inv.created * 1000).toLocaleDateString()}</span>
                        <span style={{ textTransform: "capitalize", color: inv.status === "paid" ? "#16a34a" : "var(--muted)" }}>{inv.status}</span>
                        <span style={{ fontWeight: 500 }}>{formatCents(inv.amountPaid, inv.currency)}</span>
                        {inv.pdfUrl ? <a href={inv.pdfUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>PDF</a> : <span />}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : payStep ? (
          <div style={{ padding: 22 }}>
            {(() => {
              const plan = PLAN_TIERS.find((p) => p.id === payStep.plan);
              return plan ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", border: "1px solid var(--border2)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, background: "var(--surface2)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{plan.name} plan</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{plan.price}</div>
                </div>
              ) : null;
            })()}
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
              You'll be charged the amount above, billed monthly, starting today. Cancel anytime from "Manage billing" below. Card details go straight to Stripe — this app never sees or stores them.
            </div>
            <div ref={mountRef} style={{ marginBottom: 16 }} />
            {payErr && <div style={{ fontSize: 12, color: "#dc2626", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12 }}>{payErr}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void confirmPay()} disabled={payBusy} style={{ ...barPrimary, opacity: payBusy ? 0.6 : 1 }}>{payBusy ? "Processing…" : "Pay & upgrade"}</button>
              <button onClick={() => { setPayStep(null); setPayErr(""); }} disabled={payBusy} style={{ ...barGhost, opacity: payBusy ? 0.5 : 1 }}>Back to plans</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 12 }}>
              By upgrading you agree to the <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "var(--dim)" }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: "var(--dim)" }}>Privacy Policy</a>.
            </div>
          </div>
        ) : (
          <div style={{ padding: 22 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
              Upgrading a paid plan collects payment right here — nothing redirects you off this page.
            </div>
            {payDone && <div style={{ fontSize: 12, color: "#16a34a", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12 }}>Upgraded — your new plan is active.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
              {PLAN_TIERS.map((p) => {
                const isCurrent = p.id === currentPlan;
                return (
                <div key={p.id} style={{ border: `1px solid ${isCurrent ? ACCENT : "var(--border2)"}`, borderRadius: 12, padding: 14, background: isCurrent ? "var(--accent-soft)" : "var(--surface2)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{p.name}{isCurrent ? " · current" : ""}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{p.price}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
                    {p.features.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  {!isCurrent && (
                    <button
                      onClick={() => {
                        if (SELF_SERVE_PLANS.has(p.id)) void startCheckout(p.id);
                        else setRequestMsg(p.id === "free" ? "To downgrade, use \"Manage billing\" below to cancel your subscription, or contact support." : "Performance is a custom plan — contact us and we'll set it up.");
                      }}
                      disabled={checkoutBusy === p.id}
                      style={{ ...barGhost, width: "100%", justifyContent: "center", display: "flex", marginTop: 10, opacity: checkoutBusy === p.id ? 0.6 : 1 }}>
                      {checkoutBusy === p.id ? "Starting…" : p.id === "free" ? "Downgrade" : p.id === "performance" ? "Contact us" : "Upgrade"}
                    </button>
                  )}
                </div>
                );
              })}
            </div>
            {checkoutErr && <div style={{ fontSize: 12, color: "#dc2626", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12 }}>{checkoutErr}</div>}
            {requestMsg && <div style={{ fontSize: 12, color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12 }}>{requestMsg}</div>}
            <OtoCard ws={activeWsId} />
            {hasBillingHistory ? (
              <button onClick={openManage} style={barGhost}>{"📄 Manage billing & invoices"}</button>
            ) : (
              <div style={{ fontSize: 11, color: "var(--dim)" }}>Invoices and payment method management appear here once you have an active subscription.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
