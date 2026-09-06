/**
 * "Sell it better" — a persuasion coach for any piece of copy. Give it an asset
 * (headline, email, landing copy, ad…) and the owner's saved Message; it scores
 * the copy on four dimensions and rewrites it to sell harder in the owner's own
 * voice. Part of the Psychology pillar ("AI on every asset").
 *
 * Pure and server-free: the prompt builder and the tolerant response parser
 * live here so the SellBetter component and fast unit tests import them without
 * a network. The AI call itself uses the existing callAI pattern in the page.
 */
import type { MessageInput } from "./message-copy";
import { composeOneLiner } from "./message-copy";

export type AssetKind = "headline" | "subject" | "email" | "landing" | "ad" | "generic";

const KIND_LABEL: Record<AssetKind, string> = {
  headline: "a headline",
  subject: "an email subject line",
  email: "an email",
  landing: "landing-page copy",
  ad: "an ad",
  generic: "a piece of marketing copy",
};

// The four scoring dimensions map directly onto four proven direct-response
// frameworks — one guru's lens per dimension, the same set used across the
// Message/Offer/Positioning/Objections draft prompts:
//   - hook    → Russell Brunson's Hook-Story-Offer: a real pattern-interrupt
//               a reader recognizes, not a generic opener.
//   - clarity → Don Miller's StoryBrand: if it confuses, it loses — the
//               reader is the hero, plain words, one idea at a time.
//   - emotion → Tony Robbins' certainty principle: does it create a genuine
//               felt state-shift (real confidence/relief), or just describe
//               features and hope that lands?
//   - cta     → Ryan Deiss's Customer Value Journey: is the next step
//               proportionate to where THIS reader is, not an overreach
//               (asking a cold stranger to buy the premium tier)?
export const SELL_BETTER_SYSTEM =
  "You are a sharp direct-response copy coach scoring on four dimensions, each its own lens: hook (Russell Brunson — does it open with a real pattern-interrupt the reader recognizes, not a generic opener?), clarity (Don Miller's StoryBrand — if it confuses, it loses; is the reader the hero, in plain words, one idea at a time?), emotion (Tony Robbins' certainty principle — does it create a genuine felt state-shift, real confidence or relief, not just describe features?), and cta (Ryan Deiss's Customer Value Journey — is the next step proportionate to where this reader actually is, not an overreach?). Given a piece of marketing copy and the business's core message, score the copy on all four and rewrite it to be more persuasive by that same rubric. Keep the rewrite in the business's own voice and true to its message; never invent facts, prices, or claims. " +
  'Respond with ONLY minified JSON, no preamble or code fences, exactly: {"scores":{"hook":0,"clarity":0,"emotion":0,"cta":0},"rewrite":"","tips":["",""]}. Each score is an integer 0–10. tips are 2–4 short, specific suggestions.';

/** Compose the prompt: what kind of asset, the copy itself, the Message, and an
 *  optional strategy brief from the saved Golden Example (strategyContext) so the
 *  rewrite stays on the same loss-leader / value-ladder story. */
export function buildSellBetterPrompt(asset: string, kind: AssetKind, m: MessageInput | null | undefined, strategy?: string): string {
  const ctx: string[] = [];
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) ctx.push(`Business one-liner: ${ol}`);
  if (m?.character) ctx.push(`Customer: ${m.character}`);
  if (m?.wants) ctx.push(`They want: ${m.wants}`);
  if (m?.internalProblem) ctx.push(`How the problem feels: ${m.internalProblem}`);
  if (m?.failure) ctx.push(`Failure they avoid: ${m.failure}`);
  if (strategy?.trim()) ctx.push(strategy.trim());
  const context = ctx.length ? `Business message for grounding:\n${ctx.join("\n")}\n\n` : "";
  return `${context}This is ${KIND_LABEL[kind]}. Score and rewrite it:\n"""\n${asset.trim()}\n"""\n\nReturn the JSON now.`;
}

export interface SellScores { hook: number; clarity: number; emotion: number; cta: number; }
export interface SellBetterResult {
  scores: SellScores;
  /** 0–100 overall, the average of the four dimensions scaled up. */
  overall: number;
  rewrite: string;
  tips: string[];
}

const clampScore = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
};

/** Overall 0–100 from the four dimension scores (simple average, scaled). */
export function overallScore(s: SellScores): number {
  return Math.round(((s.hook + s.clarity + s.emotion + s.cta) / 4) * 10);
}

function stripFences(reply: string): string {
  const s = reply.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1]!.trim() : s;
}
function sliceOutermost(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}
function tryParse(s: string): unknown { try { return JSON.parse(s); } catch { return undefined; } }

/**
 * Parse a "sell it better" reply into a validated result. Tolerant of code
 * fences and surrounding prose. Returns null when there's no usable rewrite, so
 * the caller can keep the original copy and prompt a retry.
 */
export function parseSellBetter(reply: string): SellBetterResult | null {
  const cleaned = stripFences(reply);
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const rewrite = typeof o.rewrite === "string" ? o.rewrite.trim() : "";
  if (!rewrite) return null; // no rewrite → not usable

  const rawScores = (o.scores ?? {}) as Record<string, unknown>;
  const scores: SellScores = {
    hook: clampScore(rawScores.hook),
    clarity: clampScore(rawScores.clarity),
    emotion: clampScore(rawScores.emotion),
    cta: clampScore(rawScores.cta),
  };
  const tips = Array.isArray(o.tips)
    ? o.tips.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 5)
    : [];

  return { scores, overall: overallScore(scores), rewrite, tips };
}
