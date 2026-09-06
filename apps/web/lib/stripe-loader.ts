"use client";
/**
 * Minimal client-side Stripe.js loader + the sliver of the Stripe global this
 * app actually calls. The app carries no Stripe SDK dependency (client or
 * server) on purpose — payment card fields are the one thing that must come
 * from Stripe's own hosted script so raw card data never touches our origin.
 * Shared by the subscription checkout and the public funnel's paid step.
 */
export const STRIPE_JS_SRC = "https://js.stripe.com/v3/";

export interface StripeElement { mount(el: HTMLElement): void; unmount(): void }
export interface StripeElements { create(type: "payment"): StripeElement }
export interface StripeJs {
  elements(opts: { clientSecret: string }): StripeElements;
  confirmPayment(opts: { elements: StripeElements; redirect: "if_required" }): Promise<{ error?: { message?: string } }>;
  confirmSetup(opts: { elements: StripeElements; redirect: "if_required" }): Promise<{ error?: { message?: string }; setupIntent?: { payment_method?: string } }>;
}
declare global { interface Window { Stripe?: (publishableKey: string) => StripeJs } }

/** Load Stripe.js once, resolving when window.Stripe is available. */
export function loadStripeJs(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_JS_SRC}"]`);
  if (existing) return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }));
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = STRIPE_JS_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Stripe.js"));
    document.head.appendChild(s);
  });
}

/** Format minor units as a localized currency string, with a plain fallback. */
export function formatCents(amountCents: number, currency: string): string {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(amountCents / 100); }
  catch { return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`; }
}
