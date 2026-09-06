/**
 * Pure copy composition from the saved Message — deliberately free of any
 * server/db dependency (unlike lib/message.ts, which pulls in the workspace
 * store), so both the funnel-builder *client* component and fast unit tests can
 * import it without bundling Postgres.
 *
 * This is the "one voice" wiring: the one-liner seeds a new funnel's intro, and
 * the story grid seeds its outcome screens — which in turn seed the automated
 * follow-up email (lib/acquisition/follow-up.ts composes the email straight from
 * the outcome copy). So writing the Message once flows all the way to the note a
 * lead gets after they close the tab, in the owner's own words.
 */

export interface OneLinerInput {
  problem?: string;
  solution?: string;
  result?: string;
}

export interface MessageInput {
  oneLiner?: OneLinerInput;
  character?: string;
  wants?: string;
  internalProblem?: string;
  plan?: string;
  success?: string;
  failure?: string;
}

/** Trim trailing whitespace/periods so we can re-punctuate cleanly. */
const strip = (s: string | undefined): string => (s ?? "").trim().replace(/[.\s]+$/, "");
/** Same, but lowercased first letter for use mid-sentence (kept as-is when the
 *  first token is an acronym/brand like "OneVYRT" so we don't mangle it). */
const mid = (s: string | undefined): string => {
  const t = strip(s);
  if (!t) return "";
  const firstWord = t.split(/\s/, 1)[0]!;
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) return t; // acronym / ALL-CAPS
  return t.charAt(0).toLowerCase() + t.slice(1);
};

/** Compose the saved one-liner into a single reusable sentence. Empty when the
 *  one-liner isn't complete enough to speak with. Mirrors composeOneLiner in
 *  lib/message.ts, minus the server dependency. */
export function composeOneLiner(o: OneLinerInput | undefined): string {
  const p = strip(o?.problem);
  const s = strip(o?.solution);
  const r = strip(o?.result);
  if (!p || !s || !r) return "";
  return `${p}. ${s}, so ${r}.`;
}

export interface OutcomeCopy {
  heading: string;
  body: string;
}

export interface MessageOutcomes {
  qualified?: Partial<OutcomeCopy>;
  nurture?: Partial<OutcomeCopy>;
  unqualified?: Partial<OutcomeCopy>;
}

/**
 * Seed the three outcome screens from the story grid. Only returns fields we can
 * genuinely say in the owner's own words; anything the Message doesn't provide is
 * omitted, so the funnel keeps its sensible built-in default there. The result is
 * a starting point the owner edits — the point is that it opens speaking *their*
 * message, not blank SaaS boilerplate.
 */
export function outcomesFromMessage(m: MessageInput | null | undefined): MessageOutcomes {
  if (!m) return {};
  const out: MessageOutcomes = {};

  const wants = mid(m.wants);
  const success = mid(m.success);
  const plan = strip(m.plan);
  const solution = strip(m.oneLiner?.solution);
  const internal = mid(m.internalProblem);
  const failure = mid(m.failure);

  // qualified — they're a fit; book the call, framed by what they came for.
  const qHead = success ? `You're a great fit — let's get you ${success}` : "";
  const qBody = wants
    ? `Book a time and we'll map the fastest path to ${wants}.`
    : success
      ? `Book a time and we'll map the fastest path to ${success}.`
      : "";
  if (qHead || qBody) out.qualified = { ...(qHead ? { heading: qHead } : {}), ...(qBody ? { body: qBody } : {}) };

  // nurture — a strong path; hand them the plan as a playbook and follow up.
  const nBody = plan
    ? `Here's the plan we'd run: ${plan}. Get the playbook and we'll follow up when the timing's right.`
    : solution
      ? `${solution}. Get the playbook and we'll follow up when the timing's right.`
      : "";
  if (nBody) out.nurture = { body: nBody };

  // unqualified — start lighter; meet them where they are with a free resource.
  const uBody = internal
    ? `No pressure — plenty of people feel ${internal} at the start. Our free training will get you moving.`
    : failure
      ? `Our free training helps you steer clear of ${failure} while you find your feet.`
      : "";
  if (uBody) out.unqualified = { body: uBody };

  return out;
}

/**
 * AI-draft the whole Message — grounded in four proven direct-response
 * frameworks rather than generic "write me some marketing copy":
 *   - Don Miller / StoryBrand SB7: the customer is the hero, the business is
 *     only the guide; the problem is stated at three levels (external,
 *     internal, philosophical) — the internal one is usually what sells; if
 *     it confuses, it loses, so plain words and one idea per sentence.
 *   - Russell Brunson's Hook: the one-liner's problem needs a real
 *     pattern-interrupt a prospect recognizes, not a generic industry line.
 *   - Ryan Deiss's Customer Value Journey: this message is the first
 *     touchpoint, not the whole pitch — the result should be a believable
 *     near-term win that earns the next step, not an overwhelming end-state.
 *   - Tony Robbins' certainty: "success" should read as a felt emotional
 *     shift — real relief or confidence, not just a checklist outcome —
 *     because certainty is what actually moves someone to act.
 * Pure text — the actual AI call happens client-side (BYO key); this just
 * builds the two strings so they're shared and testable without one.
 */
export const MESSAGE_DRAFT_SYSTEM =
  "You are a direct-response messaging strategist writing in Don Miller's StoryBrand framework, sharpened by Russell Brunson's Hook-Story-Offer, Ryan Deiss's Customer Value Journey and Tony Robbins' certainty principle. " +
  "StoryBrand: the CUSTOMER is the hero, the business is only the guide — never write as if the business is the hero. State the problem at all three levels: external (the practical problem), internal (how it makes them feel), philosophical (why it's just plain wrong) — the internal problem is usually what actually sells, so put real feeling into internalProblem. If it confuses, it loses: plain words, one clear idea per sentence, no jargon. " +
  "Brunson's Hook: open the one-liner's problem with a real pattern-interrupt — the exact moment or frustration a real prospect would recognize, not a generic industry complaint. " +
  "Deiss's Customer Value Journey: this message is the first touchpoint, not the whole pitch — the result should be a believable, near-term win that earns the next step, not an overwhelming end-state. " +
  "Robbins' certainty: write success as a felt emotional shift — real relief or confidence, not just a checklist outcome — because certainty is what actually moves someone to act. " +
  'Respond with ONLY minified JSON with exactly these keys: {"character":"","wants":"","internalProblem":"","plan":"","success":"","failure":"","oneLiner":{"problem":"","solution":"","result":""}}';

export function buildMessageDraftPrompt(desc: string, existing?: MessageInput, strategy = ""): string {
  const lines: string[] = [];
  if (strategy.trim()) lines.push(`BUSINESS STRATEGY (make the message serve this goal, gaps and constraint):\n${strategy.trim()}`);
  if (desc.trim()) lines.push(`Business: ${desc.trim()}`);
  if (existing?.character) lines.push(`Customer: ${existing.character}`);
  if (existing?.wants) lines.push(`They want: ${existing.wants}`);
  if (existing?.internalProblem) lines.push(`How the problem feels: ${existing.internalProblem}`);
  if (existing?.plan) lines.push(`Our plan: ${existing.plan}`);
  if (existing?.success) lines.push(`Success looks like: ${existing.success}`);
  if (existing?.failure) lines.push(`Failure they avoid: ${existing.failure}`);
  if (existing?.oneLiner?.problem) lines.push(`Existing problem draft: ${existing.oneLiner.problem}`);
  if (existing?.oneLiner?.solution) lines.push(`Existing solution draft: ${existing.oneLiner.solution}`);
  if (existing?.oneLiner?.result) lines.push(`Existing result draft: ${existing.oneLiner.result}`);
  const ctx = lines.length ? lines.join("\n") : "No details yet — infer a strong message for a small business using a marketing funnel tool.";
  return `Business details:\n${ctx}\n\nWrite the full message JSON now.`;
}
