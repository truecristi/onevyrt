/**
 * Phase 9 Build slice: offer prices are stored and sent over the wire as
 * integer minor units (cents) end to end (contracts/offers.ts, spec §40) -
 * these two helpers are the single place the UI converts to/from the
 * dollars a person actually types and reads, so the cents<->dollars edge
 * is never re-derived inconsistently across the create form, the edit
 * form and the read-only display.
 */

/** Cents (or null) -> a display string like "$49.00 USD", or a dash when unpriced. */
export function formatPrice(priceCents: number | null, currency: string): string {
  if (priceCents === null) return "No price set";
  return `$${(priceCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/** A dollars string from an <input> -> integer cents, or null when blank. Returns NaN for non-numeric input so the caller can reject it. */
export function dollarsToCents(dollars: string): number | null {
  const trimmed = dollars.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
}

/** Integer cents (or null) -> the dollars string an <input type="number"> should show. */
export function centsToDollars(priceCents: number | null): string {
  if (priceCents === null) return "";
  return (priceCents / 100).toFixed(2);
}
