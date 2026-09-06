/**
 * Offer & positioning coach — the "Positioning & Offer" area of the Psychology
 * pillar. Helps shape WHAT you sell: a named offer, a specific promise, a
 * stack of deliverables, price framing, a guarantee, and answers to the top
 * objections. A deterministic strength score keeps it honest; an optional AI
 * layer drafts a first offer from the saved Message.
 *
 * Pure and server-free (no React, no db): this module owns the OfferData shape,
 * sanitisation and scoring so the coach page, the server store (lib/offer.ts)
 * and fast unit tests all share one source of truth without pulling in Postgres.
 */
import type { MessageInput } from "./message-copy";
import { composeOneLiner } from "./message-copy";

export interface OfferObjection { q: string; a: string; }

export interface OfferData {
  name: string;        // the offer's name — "The Funnel Fix Sprint"
  promise: string;     // the core transformation / result they get
  deliverables: string[]; // what's included (the value stack)
  price: string;       // headline price (kept as a string for any currency)
  priceAnchor: string; // what it's worth / would otherwise cost — frames the price
  guarantee: string;   // risk reversal
  objections: OfferObjection[]; // the top objections, answered
  // — Positioning (why you, over the alternative) —
  audience: string;    // who this offer is for — the specific buyer
  alternative: string; // the status quo / what they'd otherwise do or use
  edge: string;        // your unique mechanism — why you beat the alternative
  updatedAt?: string;
}

export const EMPTY_OFFER: OfferData = {
  name: "", promise: "", deliverables: [], price: "", priceAnchor: "", guarantee: "", objections: [],
  audience: "", alternative: "", edge: "",
};

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

export function sanitizeOffer(v: unknown): OfferData {
  const o = (v ?? {}) as Record<string, unknown>;
  const deliverables = Array.isArray(o.deliverables)
    ? o.deliverables.map((d) => clip(d, 200)).filter((d) => d.trim()).slice(0, 12)
    : [];
  const objections = Array.isArray(o.objections)
    ? o.objections
        .map((it) => { const r = (it ?? {}) as Record<string, unknown>; return { q: clip(r.q, 200), a: clip(r.a, 400) }; })
        .filter((it) => it.q.trim() || it.a.trim())
        .slice(0, 10)
    : [];
  return {
    name: clip(o.name, 120),
    promise: clip(o.promise, 400),
    deliverables,
    price: clip(o.price, 60),
    priceAnchor: clip(o.priceAnchor, 200),
    guarantee: clip(o.guarantee, 400),
    objections,
    audience: clip(o.audience, 160),
    alternative: clip(o.alternative, 200),
    edge: clip(o.edge, 300),
  };
}

/** Pull a numeric amount out of a free-form price string ("$2,000" → 2000,
 *  "£79/mo" → 79). Returns 0 when there's no number to find. */
export function parseOfferPrice(price: string | undefined): number {
  const m = (price ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export type Severity = "good" | "warn" | "fix";
export interface OfferFinding { id: string; area: string; severity: Severity; message: string; }
export interface OfferScore { score: number; started: boolean; findings: OfferFinding[]; }

const WEIGHT: Record<Severity, number> = { good: 0, warn: 8, fix: 15 };

/** True once the founder has typed anything into the offer half of the form
 *  (name, promise, deliverables, price, anchor, guarantee, or an objection).
 *  A completely untouched offer isn't "23% complete" — it's not started, and
 *  scoreOffer forces its score to 0 rather than the leftover credit an empty
 *  form's lighter ('warn', not 'fix') penalties would otherwise leave it. */
export function hasAnyOfferInput(o: OfferData): boolean {
  return !!(o.name.trim() || o.promise.trim() || o.deliverables.length || o.price.trim()
    || o.priceAnchor.trim() || o.guarantee.trim() || o.objections.some((x) => x.q.trim() || x.a.trim()));
}

/** Score the offer's persuasive completeness, worst findings first. */
export function scoreOffer(o: OfferData): OfferScore {
  const f: OfferFinding[] = [];
  const name = o.name.trim();
  const promise = o.promise.trim();
  const answered = o.objections.filter((x) => x.q.trim() && x.a.trim()).length;

  if (!name) f.push({ id: "name", area: "Name", severity: "fix", message: "Name your offer — a named offer feels real and premium, not a vague service." });
  else f.push({ id: "name-ok", area: "Name", severity: "good", message: "Your offer has a name." });

  if (!promise) f.push({ id: "promise", area: "Promise", severity: "fix", message: "State the promise — the specific outcome they walk away with." });
  else if (promise.length < 20) f.push({ id: "promise-thin", area: "Promise", severity: "warn", message: "Make the promise more specific — a concrete result beats a vague benefit." });
  else f.push({ id: "promise-ok", area: "Promise", severity: "good", message: "The promise is specific." });

  if (o.deliverables.length === 0) f.push({ id: "deliv", area: "Deliverables", severity: "fix", message: "List what's included — an unbundled offer is hard to say yes to." });
  else if (o.deliverables.length < 3) f.push({ id: "deliv-thin", area: "Deliverables", severity: "warn", message: "Stack at least three deliverables so the value is obvious at a glance." });
  else f.push({ id: "deliv-ok", area: "Deliverables", severity: "good", message: `${o.deliverables.length} deliverables — a clear value stack.` });

  if (!o.price.trim()) f.push({ id: "price", area: "Price", severity: "warn", message: "Set a price — even a placeholder anchors the conversation." });
  if (!o.priceAnchor.trim()) f.push({ id: "anchor", area: "Price", severity: "warn", message: "Anchor the price — what it's worth, or what it would otherwise cost, makes it feel like a deal." });

  if (!o.guarantee.trim()) f.push({ id: "guarantee", area: "Guarantee", severity: "warn", message: "Add a guarantee — reversing the risk lifts conversions more than almost anything." });
  else f.push({ id: "guarantee-ok", area: "Guarantee", severity: "good", message: "You reverse the risk with a guarantee." });

  if (answered < 2) f.push({ id: "objections", area: "Objections", severity: "warn", message: "Answer the top two or three objections before they're even asked." });
  else f.push({ id: "objections-ok", area: "Objections", severity: "good", message: `${answered} objections handled up front.` });

  const penalty = f.reduce((s, x) => s + WEIGHT[x.severity], 0);
  const started = hasAnyOfferInput(o);
  const score = started ? Math.max(0, Math.min(100, 100 - penalty)) : 0;
  const rank: Record<Severity, number> = { fix: 0, warn: 1, good: 2 };
  f.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { score, started, findings: f };
}

// — Optional AI draft from the Message —

// Grounded in four direct-response frameworks, the same as the Message draft
// (lib/studio/message-copy.ts's MESSAGE_DRAFT_SYSTEM):
//   - Don Miller / StoryBrand: the offer is "the plan" that resolves the
//     customer's problem from the Message — a few clear, simple steps, never
//     a wall of features.
//   - Russell Brunson's Stack/Value Ladder: deliverables should read as a
//     stack of distinct value pieces building toward one obvious price, and
//     this offer's ambition should fit its rung on the ladder — an entry
//     offer earns trust, it doesn't try to sell the whole transformation.
//   - Tony Robbins' certainty: the guarantee exists to remove enough risk
//     that saying yes feels certain, not as legal boilerplate.
//   - Ryan Deiss's Customer Value Journey: never promise more than this one
//     offer, at this one price, can actually deliver.
export const OFFER_DRAFT_SYSTEM =
  "You are an offer strategist writing in Russell Brunson's Value Ladder / stack tradition, grounded by Don Miller's StoryBrand (this offer is 'the plan' that resolves the customer's problem — simple, a few clear steps, never a wall of features) and Ryan Deiss's Customer Value Journey (never promise more than this one offer, at this one price, can actually deliver — match the offer's ambition to its rung on the ladder). From a business's core message, draft a compelling, specific offer. Give it a confident name, a one-sentence promise of the outcome, 3–5 concrete deliverables that stack as distinct value building to one obvious price, a plausible price and a value anchor, and a guarantee that follows Tony Robbins' certainty principle — real enough risk reversal that saying yes feels certain, not legal boilerplate. Also answer the 2–3 objections most likely to stop the sale. Never invent facts the message doesn't support; where a real number is unknown use a clearly-placeholder like [your price]. " +
  'Respond with ONLY minified JSON, no preamble or fences: {"name":"","promise":"","deliverables":["",""],"price":"","priceAnchor":"","guarantee":"","objections":[{"q":"","a":""}]}.';

export function buildOfferDraftPrompt(m: MessageInput | null | undefined, strategy = ""): string {
  const lines: string[] = [];
  if (strategy.trim()) lines.push(`BUSINESS STRATEGY (shape the offer to this goal, gaps and growth constraint):\n${strategy.trim()}`);
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) lines.push(`One-liner: ${ol}`);
  if (m?.character) lines.push(`Customer: ${m.character}`);
  if (m?.wants) lines.push(`They want: ${m.wants}`);
  if (m?.internalProblem) lines.push(`How the problem feels: ${m.internalProblem}`);
  if (m?.plan) lines.push(`Our plan: ${m.plan}`);
  if (m?.success) lines.push(`Success: ${m.success}`);
  if (m?.failure) lines.push(`Failure they avoid: ${m.failure}`);
  const ctx = lines.length ? lines.join("\n") : "A general small-business service offer.";
  return `${ctx}\n\nDraft the offer now.`;
}

function stripFences(reply: string): string {
  const s = reply.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? (fence[1] ?? "").trim() : s;
}
function sliceOutermost(s: string): string {
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}
function tryParse(s: string): unknown { try { return JSON.parse(s); } catch { return undefined; } }

/**
 * Parse an AI offer draft into a sanitised OfferData (so it's immediately safe
 * to load into the form). Returns null when nothing usable came back.
 */
export function parseOfferDraft(reply: string): OfferData | null {
  const cleaned = stripFences(reply);
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  if (!parsed || typeof parsed !== "object") return null;
  const o = sanitizeOffer(parsed);
  // Require at least a name or promise to consider it usable.
  if (!o.name.trim() && !o.promise.trim()) return null;
  return o;
}

// — AI: suggest objections & answers for an offer —

// Tony Robbins' state/certainty principle does most of the work here: an
// objection voiced as logic ("too expensive") is usually a stand-in for an
// emotional state (fear of another disappointment, not enough certainty yet)
// — the answer should shift that state, not just out-argue the surface claim.
// Russell Brunson's common conversion-killers (money, time, "will this work
// for someone like me", trust in the messenger) keep the list realistic
// rather than generic; Ryan Deiss's Customer Value Journey keeps the answer
// proportionate to how early this prospect actually is.
export const OBJECTIONS_SYSTEM =
  "You are a sales objection strategist working from Tony Robbins' state/certainty principle: an objection voiced as logic (too expensive, not sure it'll work, need to think about it) is usually standing in for an emotional state — fear of another disappointment, not enough certainty yet — so the answer should shift that state and build certainty, not just out-argue the surface claim. Draw the objections themselves from Russell Brunson's common conversion-killers (money, time, 'will this work for someone like me', trust in who's selling) so the list is realistic, not generic, and keep each answer proportionate to how early this prospect likely is (Ryan Deiss's Customer Value Journey) — no over-promising to a stranger. Given a business's offer and message, list the 3–4 objections most likely to stop the sale, and for each a short, honest answer that dissolves it without hype or false claims. Base them on this specific offer, not generic ones. " +
  'Respond with ONLY minified JSON, no preamble or fences: {"objections":[{"q":"the objection, in the customer\'s voice","a":"your answer"}]}.';

/** Build the prompt for objection suggestions from the current offer + message. */
export function buildObjectionsPrompt(offer: OfferData, m: MessageInput | null | undefined, strategy = ""): string {
  const lines: string[] = [];
  if (strategy.trim()) lines.push(`BUSINESS STRATEGY (surface the objections that matter for this goal and constraint):\n${strategy.trim()}`);
  if (offer.name.trim()) lines.push(`Offer: ${offer.name.trim()}`);
  if (offer.promise.trim()) lines.push(`Promise: ${offer.promise.trim()}`);
  if (offer.deliverables.length) lines.push(`Includes: ${offer.deliverables.join("; ")}`);
  if (offer.price.trim()) lines.push(`Price: ${offer.price.trim()}`);
  if (offer.guarantee.trim()) lines.push(`Guarantee: ${offer.guarantee.trim()}`);
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) lines.push(`Business one-liner: ${ol}`);
  if (m?.character) lines.push(`Customer: ${m.character}`);
  const ctx = lines.length ? lines.join("\n") : "A general small-business offer.";
  return `${ctx}\n\nList the objections and answers now.`;
}

/**
 * Parse an AI objections reply into sanitised OfferObjection[] (deduped by
 * question, capped at 6, empties dropped). Returns [] when nothing usable came
 * back, so the caller keeps the existing objections.
 */
export function parseObjections(reply: string): OfferObjection[] {
  const cleaned = stripFences(reply);
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { objections?: unknown })?.objections)
      ? (parsed as { objections: unknown[] }).objections
      : [];
  const out: OfferObjection[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const q = clip(r.q, 200).trim();
    const a = clip(r.a, 400).trim();
    if (!q && !a) continue;
    const key = q.toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push({ q, a });
    if (out.length >= 6) break;
  }
  return out;
}

// — Positioning: who it's for, and why you over the alternative —

/**
 * Compose the offer's positioning into one plain sentence. Empty until there's
 * enough to say something real (an audience plus either a promise or an edge).
 */
export function composePositioning(o: OfferData): string {
  const audience = o.audience.trim();
  const name = o.name.trim() || "we";
  const promise = o.promise.trim().replace(/[.\s]+$/, "");
  const alt = o.alternative.trim().replace(/[.\s]+$/, "");
  const edge = o.edge.trim().replace(/[.\s]+$/, "");
  if (!audience || (!promise && !edge)) return "";
  let s = promise ? `For ${audience}, ${name} ${/^we$/i.test(name) ? "get you" : "is how you get"} ${lower(promise)}.` : `${name} is for ${audience}.`;
  if (alt && edge) s += ` Unlike ${lower(alt)}, ${lower(edge)}.`;
  else if (edge) s += ` What makes it different: ${edge}.`;
  else if (alt) s += ` Not another ${lower(alt)}.`;
  return s;
}

function lower(s: string): string {
  const first = s.split(/\s/, 1)[0] ?? "";
  if (first.length > 1 && first === first.toUpperCase()) return s; // acronym / brand
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export interface PositioningScore { score: number; started: boolean; findings: OfferFinding[]; }

/** True once the founder has typed anything into the positioning half of the
 *  form (audience, alternative, or edge) — the offer fields don't count, so
 *  filling in the offer alone doesn't make positioning look "started". */
export function hasAnyPositioningInput(o: OfferData): boolean {
  return !!(o.audience.trim() || o.alternative.trim() || o.edge.trim());
}

/** Score how sharp the positioning is: who it's for, the alternative, the edge. */
export function scorePositioning(o: OfferData): PositioningScore {
  const f: OfferFinding[] = [];
  if (!o.audience.trim()) f.push({ id: "audience", area: "Audience", severity: "fix", message: "Name exactly who it's for — a sharp audience makes every word land harder." });
  else if (o.audience.trim().length < 8) f.push({ id: "audience-thin", area: "Audience", severity: "warn", message: "Get more specific about who it's for — narrow beats broad." });
  else f.push({ id: "audience-ok", area: "Audience", severity: "good", message: "You've named a specific audience." });

  if (!o.edge.trim()) f.push({ id: "edge", area: "Edge", severity: "fix", message: "State your edge — the one reason you beat the obvious alternative." });
  else f.push({ id: "edge-ok", area: "Edge", severity: "good", message: "Your differentiator is stated." });

  if (!o.alternative.trim()) f.push({ id: "alt", area: "Alternative", severity: "warn", message: "Name the alternative you're up against — positioning is always against something." });
  else f.push({ id: "alt-ok", area: "Alternative", severity: "good", message: "You've named what you're positioned against." });

  const penalty = f.reduce((s, x) => s + WEIGHT[x.severity], 0);
  const started = hasAnyPositioningInput(o);
  const score = started ? Math.max(0, Math.min(100, 100 - penalty)) : 0;
  const rank: Record<Severity, number> = { fix: 0, warn: 1, good: 2 };
  f.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { score, started, findings: f };
}

// StoryBrand: position against the status quo the customer already feels,
// so "unlike [alternative], we ___" reads as obviously true, not asserted.
// Brunson: a sharp, narrow audience beats "everyone" — name who actually has
// this problem, not a broad demographic. Robbins: the edge should be the
// thing that gives THIS buyer genuine certainty this is the right call, not
// just a feature difference.
export const POSITIONING_SYSTEM =
  "You are a positioning strategist writing in Don Miller's StoryBrand tradition — position against the status quo the customer already feels, so 'unlike [alternative], we ___' reads as obviously true rather than asserted. Follow Russell Brunson's instinct for a sharp, narrow audience over a broad one — name who actually has this problem, not a generic demographic. Make the edge the one thing that gives this specific buyer real certainty (Tony Robbins) that this is the right call, not just a feature difference. From a business's message and offer, write sharp positioning: the specific audience it's for, the alternative they'd otherwise use (the status quo or a competitor), and the edge — the one honest reason this beats that alternative. Be concrete and grounded in what's given; never invent facts. " +
  'Respond with ONLY minified JSON, no preamble or fences: {"audience":"","alternative":"","edge":""}.';

/** Build the positioning prompt from the current offer + message. */
export function buildPositioningPrompt(offer: OfferData, m: MessageInput | null | undefined, strategy = ""): string {
  const lines: string[] = [];
  if (strategy.trim()) lines.push(`BUSINESS STRATEGY (position toward this goal and away from the growth constraint):\n${strategy.trim()}`);
  if (offer.name.trim()) lines.push(`Offer: ${offer.name.trim()}`);
  if (offer.promise.trim()) lines.push(`Promise: ${offer.promise.trim()}`);
  if (offer.deliverables.length) lines.push(`Includes: ${offer.deliverables.join("; ")}`);
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) lines.push(`Business one-liner: ${ol}`);
  if (m?.character) lines.push(`Customer: ${m.character}`);
  if (m?.wants) lines.push(`They want: ${m.wants}`);
  if (offer.audience.trim()) lines.push(`Current audience: ${offer.audience.trim()}`);
  if (offer.alternative.trim()) lines.push(`Current alternative: ${offer.alternative.trim()}`);
  const ctx = lines.length ? lines.join("\n") : "A general small-business offer.";
  return `${ctx}\n\nWrite the positioning now.`;
}

/** Parse an AI positioning reply into the three fields (sanitised). Returns
 *  null when nothing usable came back, so the caller keeps what's there. */
export function parsePositioning(reply: string): { audience: string; alternative: string; edge: string } | null {
  const cleaned = stripFences(reply);
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  if (!parsed || typeof parsed !== "object") return null;
  const r = parsed as Record<string, unknown>;
  const audience = clip(r.audience, 160).trim();
  const alternative = clip(r.alternative, 200).trim();
  const edge = clip(r.edge, 300).trim();
  if (!audience && !edge && !alternative) return null;
  return { audience, alternative, edge };
}
