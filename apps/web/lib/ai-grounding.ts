"use client";
/**
 * ONE grounding primitive for every AI touchpoint in the app.
 *
 * The problem this solves: Campaign Studio already grounds its generators in the
 * workspace's Brand Brain (voice + facts) and Business-OS strategy (what business
 * you're really in, vision, constraint, growth levers). But the main Studio, the
 * Business-OS actions, and Insights were each calling the AI *blind* — so asking
 * the AI something in /studio had no idea what you'd filled into /business.
 *
 * This makes grounding a one-liner. A call site does:
 *
 *   const g = await loadGrounding();
 *   const user = withGrounding(g, myUserPrompt);   // prepends the brief, or no-op
 *   const reply = await callAI(conn, system, user, maxTokens);
 *
 * or, for a component that already loads on mount, keep the brief in state and
 * pass `g.block` into whatever prompt builder it uses. Both briefs are
 * best-effort: not signed in, no brand, or nothing filled in → empty block and
 * the prompt is unchanged, so nothing ever breaks for a fresh workspace.
 */
import { loadBrandProfile, brandBrief, hasBrand } from "./campaign/brand-brief";
import { loadStrategyBrief, strategyBlock } from "./campaign/strategy-brief";

export interface Grounding {
  /** The ready-to-splice context block, or "" when there's nothing to ground on. */
  block: string;
  /** True when `block` carries at least one of brand / strategy. */
  has: boolean;
  /** True when the Brand Brain is feeding the block — for GroundingChips. */
  brand: boolean;
  /** True when the Business-OS strategy is feeding the block — for GroundingChips. */
  strategy: boolean;
}

/** Fetches the Brand Brain + Business-OS strategy and assembles one context
 *  block. Both fetches run in parallel and each fails soft to empty. */
export async function loadGrounding(): Promise<Grounding> {
  const [brand, strategy] = await Promise.all([
    loadBrandProfile().catch(() => null),
    loadStrategyBrief().catch(() => null),
  ]);
  const brandTxt = hasBrand(brand) ? brandBrief(brand) : "";
  const strategyTxt = strategyBlock(strategy); // already prefixed, or "" when absent
  const parts = [
    brandTxt && `BRAND (write in this voice, use these facts — never contradict them):\n${brandTxt}`,
    strategyTxt,
  ].filter(Boolean) as string[];
  const block = parts.join("\n\n");
  return { block, has: block.length > 0, brand: brandTxt.length > 0, strategy: strategyTxt.length > 0 };
}

/** Prepend the grounding block to a user prompt (no-op when there's nothing to
 *  ground on), so the AI answers for THIS business, not a generic one. */
export function withGrounding(g: Grounding | null | undefined, userPrompt: string): string {
  return g && g.has ? `${g.block}\n\n---\n\n${userPrompt}` : userPrompt;
}
