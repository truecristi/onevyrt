/**
 * Swipe Library — proven copy *formulas* (not copied copy) that adapt to the
 * owner's saved Message, so nobody starts from a blank page. Each swipe is a
 * template with {tokens}; fillSwipe() substitutes the Message's own words and
 * leaves a clear [bracketed hint] wherever the Message is still silent, so the
 * result reads as a draft to finish, never as broken text.
 *
 * Pure and server-free (no React, no fetch): the Swipe page and fast unit tests
 * both import it. The formulas are generic structures (PAS, StoryBrand, etc.),
 * not any brand's proprietary copy.
 */
import type { MessageInput } from "./message-copy";
import { composeOneLiner } from "./message-copy";

export type SwipeCategory = "Headlines" | "Hooks" | "Offer" | "Story" | "Ads" | "Email";

export interface Swipe {
  id: string;
  category: SwipeCategory;
  name: string;
  template: string;
  /** One line on when to reach for it. */
  note: string;
}

export const SWIPE_CATEGORIES: SwipeCategory[] = ["Headlines", "Hooks", "Offer", "Story", "Ads", "Email"];

export const SWIPES: Swipe[] = [
  // — Headlines —
  { id: "hl-guide", category: "Headlines", name: "The guide", template: "The {customer}'s guide to {wants} — without {failure}.", note: "Positions you as the mentor, not the hero." },
  { id: "hl-evenif", category: "Headlines", name: "Even if", template: "How to {wants} — even if {feeling}.", note: "Beats the reader's biggest objection up front." },
  { id: "hl-without", category: "Headlines", name: "Result, no pain", template: "{result} — without {failure}.", note: "The promise minus the thing they dread." },
  { id: "hl-finally", category: "Headlines", name: "Finally", template: "Finally: {wants}, built for {customer}.", note: "Relief framing for a tired market." },
  { id: "hl-number", category: "Headlines", name: "The specific promise", template: "{result} in [timeframe] — the {customer} playbook.", note: "A number and a timeframe make it believable." },
  { id: "hl-question", category: "Headlines", name: "The callout question", template: "Still {feeling} about {problem}? Here's how {customer} finally {wants}.", note: "Ask the exact question on their mind." },

  // — Hooks (Problem · Agitate · Solve) —
  { id: "hk-pas", category: "Hooks", name: "Problem–Agitate–Solve", template: "Most {customer} {problem}. Left alone, that means {failure}. The fix: {solution} — so you {result}.", note: "The workhorse opener for ads and landing pages." },
  { id: "hk-notfault", category: "Hooks", name: "Not your fault", template: "If you {problem}, it's not your fault — no one showed you {plan}. Here's how it works: {solution}.", note: "Lowers defenses before the pitch." },
  { id: "hk-bab", category: "Hooks", name: "Before–After–Bridge", template: "Before: {problem}. After: {success}. The bridge that gets you there: {solution}.", note: "Paints the gap, then names the crossing." },
  { id: "hk-costof", category: "Hooks", name: "The real cost", template: "What {problem} is really costing you: {failure}. {solution} puts an end to it.", note: "Make the pain concrete before the fix." },

  // — Offer —
  { id: "of-getso", category: "Offer", name: "Get / So you can", template: "You get: {solution}. So you can: {result}. Backed by [your guarantee].", note: "Feature → outcome → risk reversal." },
  { id: "of-stack", category: "Offer", name: "Transformation stack", template: "Today: {problem}. With us: {plan}. In [timeframe]: {success}.", note: "Before → path → after, made concrete." },
  { id: "of-onlyfor", category: "Offer", name: "Only for", template: "This is for {customer} who want {wants} and are done {feeling}. If that's you, {solution} was built for it.", note: "Qualify hard — the right people lean in." },
  { id: "of-risk", category: "Offer", name: "Risk reversal", template: "Try {solution}. If you don't {result}, [your guarantee] — the risk is on us, not you.", note: "Move the risk off the buyer to lift conversions." },

  // — Story (StoryBrand) —
  { id: "st-sb1", category: "Story", name: "One-paragraph StoryBrand", template: "You want {wants}. The trouble is {problem}, and it makes you feel {feeling}. We understand — that's why we built {solution}. Follow {plan}, and you'll {success} instead of {failure}.", note: "The whole narrative in one paragraph." },
  { id: "st-oneliner", category: "Story", name: "Your one-liner", template: "{oneLiner}", note: "Your saved one-liner, ready to paste anywhere." },
  { id: "st-3act", category: "Story", name: "Three-act arc", template: "Act 1: you {problem}. Act 2: you find {solution} and follow {plan}. Act 3: you {success}.", note: "A tiny story your reader casts themselves into." },

  // — Ads —
  { id: "ad-stopstart", category: "Ads", name: "Stop / Start", template: "Stop {failure}. Start {wants}. {solution} shows you how.", note: "Punchy contrast for cold traffic." },
  { id: "ad-callout", category: "Ads", name: "Callout", template: "Attention {customer}: still {feeling} about {problem}? Watch this.", note: "Names the exact person to stop the scroll." },
  { id: "ad-mistake", category: "Ads", name: "The mistake", template: "The mistake keeping {customer} from {wants}? {problem}. Here's the fix: {solution}.", note: "A mistake hook earns the click." },
  { id: "ad-3reasons", category: "Ads", name: "Three reasons", template: "3 reasons {customer} pick us to {wants}: [reason 1], [reason 2], [reason 3].", note: "Listicle structure travels well on social." },

  // — Email —
  { id: "em-question", category: "Email", name: "Quick question", template: "Quick question — are you still {feeling} about {problem}? If so, {solution} might be the missing piece.", note: "Low-pressure re-engagement opener." },
  { id: "em-short", category: "Email", name: "Keep it short", template: "I'll keep this short: {solution}, and you {result}. Worth a look? [your CTA]", note: "For a busy list that skims." },
  { id: "em-story", category: "Email", name: "One customer's story", template: "A {customer} told me they were {feeling} about {problem}. Here's what changed it: {solution} — and now they {success}. [your CTA]", note: "A mini case study beats a claim." },
  { id: "em-ps", category: "Email", name: "The P.S.", template: "P.S. If {problem} is still costing you {failure}, {solution} is worth five minutes. [your CTA]", note: "The P.S. is the most-read line — use it to close." },
];

/** Token → the Message field it draws from, with a hint used when it's empty. */
interface TokenSpec { get: (m: MessageInput) => string | undefined; hint: string }
const TOKENS: Record<string, TokenSpec> = {
  problem: { get: (m) => m.oneLiner?.problem, hint: "the problem they're in" },
  solution: { get: (m) => m.oneLiner?.solution, hint: "what you offer" },
  result: { get: (m) => m.oneLiner?.result, hint: "the result they get" },
  customer: { get: (m) => m.character, hint: "your customer" },
  wants: { get: (m) => m.wants, hint: "what they want" },
  feeling: { get: (m) => m.internalProblem, hint: "how the problem feels" },
  plan: { get: (m) => m.plan, hint: "your plan" },
  success: { get: (m) => m.success, hint: "what success looks like" },
  failure: { get: (m) => m.failure, hint: "the failure they avoid" },
  oneLiner: { get: (m) => composeOneLiner(m.oneLiner), hint: "your one-liner" },
};

const clean = (s: string | undefined): string => (s ?? "").trim().replace(/[.\s]+$/, "");
/** Lowercase the first letter for mid-sentence use, but preserve ALL-CAPS
 *  acronyms and brand/camel-case names (anything with an internal capital, like
 *  "OneVYRT"), which read wrong if their first letter is dropped. */
const mid = (s: string): string => {
  if (!s) return s;
  const first = s.split(/\s/, 1)[0]!;
  if (first === first.toUpperCase()) return s; // ALL CAPS acronym
  if (/[A-Z]/.test(first.slice(1))) return s; // internal capital → brand / camelCase
  return s.charAt(0).toLowerCase() + s.slice(1);
};
/** A token is sentence-initial if nothing, or only sentence-ending punctuation,
 *  precedes it — in which case its value keeps its original capitalisation. */
const sentenceInitial = (template: string, offset: number): boolean => {
  const before = template.slice(0, offset).replace(/\s+$/, "");
  return before === "" || ".!?:".includes(before.slice(-1));
};

/**
 * Fill a swipe template from the Message. A token with a value is dropped in
 * (lowercased mid-sentence so it reads naturally); a token the Message hasn't
 * filled becomes a visible [hint] the owner can complete. Unknown tokens are
 * left as-is. Returns { text, filled, total } so the UI can show how complete a
 * swipe is against the current Message.
 */
export function fillSwipe(template: string, m: MessageInput | null | undefined): { text: string; filled: number; total: number } {
  const msg = m ?? {};
  let filled = 0, total = 0;
  const text = template.replace(/\{(\w+)\}/g, (whole, key: string, offset: number) => {
    const spec = TOKENS[key];
    if (!spec) return whole; // not a known token — leave untouched
    total += 1;
    const raw = clean(spec.get(msg));
    if (!raw) return `[${spec.hint}]`;
    filled += 1;
    // Keep capitalisation when the token opens a sentence; otherwise lowercase.
    return sentenceInitial(template, offset) ? raw : mid(raw);
  });
  return { text, filled, total };
}

export function swipesByCategory(cat: SwipeCategory): Swipe[] {
  return SWIPES.filter((s) => s.category === cat);
}
