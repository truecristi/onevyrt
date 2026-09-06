/**
 * Client helper: load everything the guided journey needs — the done/not-done
 * signals (read from Message, Offer, Presentation, Economics, the AI connection
 * and the dashboard) plus the saved {startedAt, pace}. Shared by the /start
 * page and the home banner so the two can never show a different "next step".
 *
 * Client-only: it reads the AI connection from localStorage.
 */
import { EMPTY_OFFER, scoreOffer, parseOfferPrice, type OfferData } from "./studio/offer-coach";
import { scorePresentation } from "./studio/presentation";
import { economicsViability, type EconomicsData } from "./studio/economics";
import type { MessageInput } from "./studio/message-copy";
import type { JourneySignals, JourneyState } from "./studio/journey";
import { loadConnection } from "./ai/client";
import { providerCanGenerate } from "./ai/providers";

export async function loadJourneyInputs(opts?: { commandCenter?: unknown }): Promise<{ signals: JourneySignals; state: JourneyState }> {
  const signals: JourneySignals = {};
  let state: JourneyState = {};
  // The Command Centre page already fetches /api/command-center for itself; it
  // passes that payload here so we don't fetch the (heaviest) endpoint a second
  // time on the same page load. Other callers (/start, the plan nudge) omit it
  // and we fetch as before.
  const preCC = opts?.commandCenter;
  try {
    const [rm, ro, rp, re, rc, rj] = await Promise.all([
      fetch("/api/business/message", { credentials: "include" }),
      fetch("/api/business/offer", { credentials: "include" }),
      fetch("/api/business/presentation", { credentials: "include" }),
      fetch("/api/business/economics", { credentials: "include" }),
      preCC !== undefined ? Promise.resolve<Response | null>(null) : fetch("/api/command-center", { credentials: "include" }),
      fetch("/api/business/journey", { credentials: "include" }),
    ]);
    if (rm.ok) { const m = (await rm.json()) as MessageInput; const o = m?.oneLiner ?? {}; signals.messageComplete = !!(o.problem?.trim() && o.solution?.trim() && o.result?.trim()); }
    let offer: OfferData | null = null;
    if (ro.ok) { const off: OfferData = { ...EMPTY_OFFER, ...(await ro.json()) }; offer = off; signals.offerReady = scoreOffer(off).score >= 60; signals.positioningReady = !!(off.audience?.trim() && off.edge?.trim()); }
    if (rp.ok) { const arr = (await rp.json())?.checked; signals.presentationReady = scorePresentation(Array.isArray(arr) ? arr : []).score >= 60; }
    if (re.ok) { const econ = (await re.json()) as EconomicsData; signals.economicsReady = economicsViability(econ, parseOfferPrice(offer?.price)).viable; }
    let ccData: unknown = preCC;
    if (ccData === undefined && rc && rc.ok) ccData = await rc.json();
    if (ccData) { const a = (ccData as { acquisition?: Record<string, unknown> }).acquisition ?? {}; signals.hasFunnel = !!a.hasFunnel; signals.firstLead = ((a.leadsTotal as number) ?? 0) > 0; signals.firstBooked = ((a.booked as number) ?? 0) > 0; }
    if (rj.ok) state = (await rj.json()) as JourneyState;
  } catch { /* partial inputs are fine — missing = not done */ }
  const conn = loadConnection();
  signals.aiConnected = !!conn && providerCanGenerate(conn.provider) && conn.apiKey.trim().length > 0;
  return { signals, state };
}
