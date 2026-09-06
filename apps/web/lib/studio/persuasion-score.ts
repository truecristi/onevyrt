/**
 * Persuasion readiness — the headline score on the Psychology hub. It rolls the
 * pillar's three concrete pieces of work into one honest 0–100 number and a
 * per-part breakdown, so the hub can stop showing a placeholder and instead
 * pull the owner through the areas that still need work.
 *
 * The three parts, deliberately weighted toward the substance over the polish:
 *   • Message      — is the core story written? (StoryBrand fields)   40%
 *   • Offer        — is what you sell sharp?    (offer + positioning)  40%
 *   • Presentation — is it ready to be seen?    (scorePresentation)    20%
 *
 * The Offer part blends the offer's strength (70%) with its positioning (30%),
 * so sharpening who-it's-for and why-you actually moves the headline number.
 *
 * Pure and server-free: it composes the existing pure scorers (offer-coach,
 * presentation, message-copy) so the hub page and unit tests share one source
 * of truth and never pull in Postgres.
 */
import type { MessageInput } from "./message-copy";
import { scoreOffer, scorePositioning, type OfferData } from "./offer-coach";
import { scorePresentation } from "./presentation";

const has = (s: string | undefined): boolean => !!(s && s.trim());

/**
 * How complete the core Message is, 0–100. The one-liner is the spine, so its
 * three parts carry the most weight; the rest of the StoryBrand grid fills in
 * the depth that makes the selling specific.
 */
export function messageCompleteness(m: MessageInput | null | undefined): number {
  if (!m) return 0;
  const parts: Array<[boolean, number]> = [
    [has(m.oneLiner?.problem), 14],
    [has(m.oneLiner?.solution), 13],
    [has(m.oneLiner?.result), 13],
    [has(m.character), 12],
    [has(m.wants), 12],
    [has(m.plan), 10],
    [has(m.success), 10],
    [has(m.internalProblem), 8],
    [has(m.failure), 8],
  ];
  const got = parts.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
  return Math.max(0, Math.min(100, got));
}

export interface PersuasionParts {
  message: number;      // 0–100
  offer: number;        // 0–100
  presentation: number; // 0–100
}

export type PersuasionStage = "Just starting" | "Taking shape" | "Getting sharp" | "Dialed in";

export interface PersuasionScore {
  score: number;          // 0–100 overall, weighted
  parts: PersuasionParts;
  stage: PersuasionStage;
  /** The single part with the most room to improve, to point the owner next. */
  weakest: keyof PersuasionParts;
}

const WEIGHTS: PersuasionParts = { message: 0.4, offer: 0.4, presentation: 0.2 };

function stageFor(score: number): PersuasionStage {
  if (score < 25) return "Just starting";
  if (score < 55) return "Taking shape";
  if (score < 80) return "Getting sharp";
  return "Dialed in";
}

export interface PersuasionInput {
  message?: MessageInput | null;
  offer?: OfferData | null;
  presentationChecked?: Iterable<string>;
}

/** Roll the three pillar pieces into one persuasion readiness score. */
export function persuasionScore(input: PersuasionInput): PersuasionScore {
  const message = messageCompleteness(input.message);
  const offer = input.offer
    ? Math.round(scoreOffer(input.offer).score * 0.7 + scorePositioning(input.offer).score * 0.3)
    : 0;
  const presentation = scorePresentation(input.presentationChecked ?? []).score;
  const parts: PersuasionParts = { message, offer, presentation };

  const score = Math.round(message * WEIGHTS.message + offer * WEIGHTS.offer + presentation * WEIGHTS.presentation);

  // Weakest = the part whose weighted shortfall is largest, so finishing it
  // moves the overall number the most. Ties resolve message → offer → presentation.
  const order: Array<keyof PersuasionParts> = ["message", "offer", "presentation"];
  let weakest: keyof PersuasionParts = "message";
  let worst = -1;
  for (const k of order) {
    const shortfall = (100 - parts[k]) * WEIGHTS[k];
    if (shortfall > worst) { worst = shortfall; weakest = k; }
  }

  return { score, parts, stage: stageFor(score), weakest };
}
