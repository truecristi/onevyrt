/**
 * Reach plan — the bridge from "how many must I sell?" (break-even / profit
 * goal) all the way back to "so how much traffic do I need?". A non-technical
 * owner thinks in people, not just units, so we step back up the acquisition
 * funnel one rate at a time:
 *
 *   sales → (close rate) → conversations → (qualify rate) → leads → (opt-in) → visitors
 *
 * Each step divides the downstream count by a conversion rate and rounds up.
 * Pure and server-free: the math + its guards live here so the break-even card
 * and unit tests share one source of truth.
 */

/**
 * The upstream count needed to produce `downstream` results at a given
 * conversion rate (a percentage, 0–100). Returns null when it can't be
 * computed — no downstream target, or a non-positive rate (nothing converts at
 * 0%). Rounds UP (you can't have a fraction of a person) and caps the rate at
 * 100% (a step can't be more than one-to-one).
 */
export function upstreamCount(downstream: number | null | undefined, ratePct: number): number | null {
  if (downstream == null || !Number.isFinite(downstream) || downstream <= 0) return null;
  if (!Number.isFinite(ratePct) || ratePct <= 0) return null;
  const rate = Math.min(ratePct, 100) / 100;
  return Math.ceil(downstream / rate);
}

/** Sales conversations (qualified leads you talk to) needed to close `salesNeeded`. */
export function conversationsForSales(salesNeeded: number | null | undefined, closeRatePct: number): number | null {
  return upstreamCount(salesNeeded, closeRatePct);
}

/** Leads needed so that `conversations` of them qualify (become a real conversation). */
export function leadsForConversations(conversations: number | null | undefined, qualifyRatePct: number): number | null {
  return upstreamCount(conversations, qualifyRatePct);
}

/** Visitors needed so that `leads` of them opt in (become a lead). */
export function visitorsForLeads(leads: number | null | undefined, optInRatePct: number): number | null {
  return upstreamCount(leads, optInRatePct);
}

/**
 * The ad budget to buy `visitors` at a cost-per-visitor (both in the same
 * major-unit currency): visitors × cost. Returns null when there's no visitor
 * target or a non-positive cost (free traffic isn't an ad budget). Never
 * negative.
 */
export function adSpendForVisitors(visitors: number | null | undefined, costPerVisitor: number): number | null {
  if (visitors == null || !Number.isFinite(visitors) || visitors <= 0) return null;
  if (!Number.isFinite(costPerVisitor) || costPerVisitor <= 0) return null;
  return Math.round(visitors * costPerVisitor * 100) / 100;
}
