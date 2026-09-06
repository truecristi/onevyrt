/**
 * Content angles — the 1-to-many road to an audience, the complement to First
 * Message (1-to-1 outreach). For a founder starting from zero: given the saved
 * Offer + Message, AI proposes scroll-stopping post ideas that attract their
 * exact customer — each a hook line plus one sentence on what the post says,
 * built on proven angle types (contrarian, mistake, before/after, myth, how-to,
 * story) so it never reads as a template.
 *
 * Pure and server-free: the prompt builder + tolerant parser live here so the
 * page and unit tests share one source of truth.
 */
import type { MessageInput } from "./message-copy";
import { composeOneLiner } from "./message-copy";
import type { OfferData } from "./offer-coach";

export interface ContentAngle { hook: string; idea: string; }

export const CONTENT_SYSTEM =
  "You are a content strategist for a solo founder building an audience from zero. From their offer and message, generate distinct post ideas that would attract their EXACT customer — not the general public. Each idea is a scroll-stopping hook line (the first sentence someone reads) plus one sentence on what the post actually says. Use a spread of proven angles: a contrarian take, a common mistake, a before/after, a myth to bust, a quick how-to, a short personal story. No hashtags, no 'in today's post', no fluff. Ground every idea in the offer's real value; never invent facts. " +
  'Respond with ONLY minified JSON, no preamble or fences: {"ideas":[{"hook":"","idea":""}]}.';

/** Build the content-ideas prompt from the offer + message, optionally kept
 *  on-strategy with a brief from the saved Golden Example (strategyContext). */
export function buildContentPrompt(offer: OfferData | null | undefined, m: MessageInput | null | undefined, strategy?: string): string {
  const lines: string[] = [];
  if (offer?.name?.trim()) lines.push(`Offer: ${offer.name.trim()}`);
  if (offer?.promise?.trim()) lines.push(`The result they get: ${offer.promise.trim()}`);
  if (offer?.audience?.trim()) lines.push(`Who it's for: ${offer.audience.trim()}`);
  if (offer?.edge?.trim()) lines.push(`What makes us different: ${offer.edge.trim()}`);
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) lines.push(`Business one-liner: ${ol}`);
  if (m?.character?.trim()) lines.push(`Customer: ${m.character.trim()}`);
  if (m?.internalProblem?.trim()) lines.push(`How the problem feels to them: ${m.internalProblem.trim()}`);
  if (m?.failure?.trim()) lines.push(`What they're afraid of: ${m.failure.trim()}`);
  if (strategy?.trim()) lines.push(strategy.trim());
  const ctx = lines.length ? lines.join("\n") : "A general small-business service.";
  return `${ctx}\n\nGenerate 6 distinct post ideas now.`;
}

function stripFences(reply: string): string {
  const s = reply.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1]!.trim() : s;
}
function sliceOutermost(s: string): string {
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}
function tryParse(s: string): unknown { try { return JSON.parse(s); } catch { return undefined; } }
const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * Parse an AI content-ideas reply into clean angles (hook required; idea
 * optional), deduped by hook, capped at 10. Tolerates fences, prose and a bare
 * array. Returns [] when nothing usable came back.
 */
export function parseContentAngles(reply: string): ContentAngle[] {
  const cleaned = stripFences(reply);
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { ideas?: unknown })?.ideas)
      ? (parsed as { ideas: unknown[] }).ideas
      : [];
  const out: ContentAngle[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const hook = clip(r.hook, 200);
    const idea = clip(r.idea, 300);
    if (!hook) continue;
    const key = hook.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ hook, idea });
    if (out.length >= 10) break;
  }
  return out;
}
