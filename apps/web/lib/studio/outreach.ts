/**
 * First-message outreach — for the founder with an offer but no audience yet.
 * The funnel + ads path (Execution) needs traffic; this is the other road:
 * writing a short, human cold DM / email / LinkedIn note that actually earns a
 * reply. Given the saved Offer + Message, an AI drafts a few distinct openers
 * grounded in the owner's real value, in the owner's voice — never salesy.
 *
 * Pure and server-free: the channel definitions, prompt builder and tolerant
 * parser live here so the page and unit tests share one source of truth.
 */
import type { MessageInput } from "./message-copy";
import { composeOneLiner } from "./message-copy";
import type { OfferData } from "./offer-coach";

export type OutreachChannel = "dm" | "email" | "linkedin";

interface ChannelDef { id: OutreachChannel; label: string; note: string; words: number; }

export const OUTREACH_CHANNELS: ChannelDef[] = [
  { id: "dm", label: "DM / text", note: "Instagram, WhatsApp, SMS — very short, casual, one question.", words: 45 },
  { id: "email", label: "Cold email", note: "A tiny bit more room; still skimmable in five seconds.", words: 90 },
  { id: "linkedin", label: "LinkedIn note", note: "Professional but human; reference their work, not your pitch.", words: 70 },
];

export function channelById(id: string): ChannelDef | undefined {
  return OUTREACH_CHANNELS.find((c) => c.id === id);
}

export const OUTREACH_SYSTEM =
  "You write short, human cold outreach that earns a reply. Rules you never break: open about THEM not you; no walls of text; no hype, no 'I hope this finds you well', no fake flattery; one clear, low-friction question at the end (never 'can I book 30 minutes'). Sound like a real person texting, not a sales sequence. Ground every line in the offer's real value; never invent facts — where a detail is unknown, leave a short [bracketed placeholder] the owner fills in. " +
  'Respond with ONLY minified JSON, no preamble or fences: {"messages":["",""]}.';

/** Build the outreach prompt from the offer + message for a channel, optionally
 *  kept on-strategy with a brief from the saved Golden Example (strategyContext). */
export function buildOutreachPrompt(offer: OfferData | null | undefined, m: MessageInput | null | undefined, channel: OutreachChannel, strategy?: string): string {
  const ch = channelById(channel) ?? OUTREACH_CHANNELS[0]!;
  const lines: string[] = [];
  if (offer?.name?.trim()) lines.push(`Offer: ${offer.name.trim()}`);
  if (offer?.promise?.trim()) lines.push(`What they get: ${offer.promise.trim()}`);
  if (offer?.audience?.trim()) lines.push(`Who it's for: ${offer.audience.trim()}`);
  if (offer?.edge?.trim()) lines.push(`Why us over the alternative: ${offer.edge.trim()}`);
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) lines.push(`Business one-liner: ${ol}`);
  if (m?.character?.trim()) lines.push(`Customer: ${m.character.trim()}`);
  if (m?.internalProblem?.trim()) lines.push(`How the problem feels to them: ${m.internalProblem.trim()}`);
  if (strategy?.trim()) lines.push(strategy.trim());
  const ctx = lines.length ? lines.join("\n") : "A general small-business service.";
  return `${ctx}\n\nChannel: ${ch.label} — ${ch.note} Keep each message under ${ch.words} words.\n\nWrite 3 distinct first messages now.`;
}

export const FOLLOWUP_SYSTEM =
  "You write short, warm follow-ups to someone who didn't reply to a first cold message. Rules: never guilt-trip ('just bumping this', 'did you see my message'); lead with a NEW angle or a tiny piece of value, not a repeat; keep it SHORTER than a first message; give an easy out ('no worries if not'). Sound human, never like an automated sequence. Ground it in the offer's real value; use a short [bracketed placeholder] for anything unknown. " +
  'Respond with ONLY minified JSON, no preamble or fences: {"messages":["",""]}.';

/** Build the follow-up prompt (for someone who didn't reply to the first). */
export function buildFollowupPrompt(offer: OfferData | null | undefined, m: MessageInput | null | undefined, channel: OutreachChannel, strategy?: string): string {
  const ch = channelById(channel) ?? OUTREACH_CHANNELS[0]!;
  const lines: string[] = [];
  if (offer?.name?.trim()) lines.push(`Offer: ${offer.name.trim()}`);
  if (offer?.promise?.trim()) lines.push(`What they get: ${offer.promise.trim()}`);
  if (offer?.edge?.trim()) lines.push(`A fresh angle to lead with: ${offer.edge.trim()}`);
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) lines.push(`Business one-liner: ${ol}`);
  if (m?.character?.trim()) lines.push(`Customer: ${m.character.trim()}`);
  if (strategy?.trim()) lines.push(strategy.trim());
  const ctx = lines.length ? lines.join("\n") : "A general small-business service.";
  return `${ctx}\n\nChannel: ${ch.label} — ${ch.note} Keep each follow-up shorter than ${Math.round(ch.words * 0.7)} words.\n\nWrite 3 distinct follow-ups now (for someone who hasn't replied yet).`;
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

/**
 * Parse an AI outreach reply into a clean list of messages (trimmed, empties
 * dropped, deduped, capped at 4). Tolerates fences, prose and a bare array.
 * Returns [] when nothing usable came back.
 */
export function parseOutreach(reply: string): string[] {
  const cleaned = stripFences(reply);
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { messages?: unknown })?.messages)
      ? (parsed as { messages: unknown[] }).messages
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (typeof it !== "string") continue;
    const t = it.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.slice(0, 800));
    if (out.length >= 4) break;
  }
  return out;
}
