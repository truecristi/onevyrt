/**
 * The Golden Example — a worked demonstration of the one strategy that quietly
 * runs the most profitable businesses on earth. It's the McDonald's move: a
 * cheap "driving product" (the burger — sold thin, sometimes at a loss) gets
 * people in the door, then the real profit rides on the back end (the fries,
 * the drink, the refill, the next visit). Value climbs rung by rung; the money
 * is made after the first "yes", not on it.
 *
 * A founder doesn't want a blank template to fill in — they want to SEE what
 * they would do. So this feeds their own offer + message to the AI and gets a
 * concrete worked example for THEIR business: their driving product, their core
 * offer, their profit engine, and then the USP, the sales-page angle and the ad
 * that all sell that one story. A demonstration, not a form.
 *
 * Pure and server-free: the strategy explainer, the prompt builder and a
 * tolerant parser live here so the page and unit tests share one source of
 * truth. Same shape as outreach.ts / content-angles.ts.
 */
import type { MessageInput } from "./message-copy";
import { composeOneLiner } from "./message-copy";
import type { OfferData } from "./offer-coach";

/** One rung of the ladder in the worked example. */
export interface LadderRung {
  stage: string;  // "Driving product" | "Core offer" | "Profit engine" (label from the AI)
  name: string;   // what it actually is, for this business
  price: string;  // a plain price/label ("Free", "$7", "$2,000", "$99/mo")
  role: string;   // one line on what this rung does in the strategy
}

/** The full worked example, applied to the founder's own business. */
export interface GoldenExample {
  insight: string;         // the one-line "where the money really comes from" for them
  ladder: LadderRung[];    // driving product → core → profit engine (2–4 rungs)
  usp: string;             // the unique selling line, built on the strategy
  salesAngle: string;      // the sales-page lead / hook
  ad: string;              // a short ad written to the same story
  firstStep: string;       // the single first thing to do
  updatedAt?: string;      // set by the store on save
}

/** Plain-English explainer of the strategy — shown above the example, not sent to the AI. */
export const GOLDEN_STRATEGY = {
  title: "The McDonald's move",
  line: "Sell a cheap “driving product” to get people in the door, then make the real profit on what comes next.",
  points: [
    "The burger barely makes money — it exists to start the relationship.",
    "The fries, the drink and the refill are where the profit is.",
    "Every rung is easy to say yes to, and each one raises the value.",
    "You win on the back end, not the first sale.",
  ],
} as const;

/** A built-in, real-world worked example shown for reference on the page, so a
 *  founder can see the strategy in action before generating their own. */
export interface GoldenSample {
  id: string;
  title: string;     // the brand
  subtitle: string;  // the one-line "why it's here"
  example: GoldenExample;
  adapt?: string;    // "make it yours" — how to map this famous ladder onto your own business
}

/**
 * Two famous value ladders, worked out the same way the AI works out the
 * founder's own. McDonald's is the everyday version everyone already
 * understands; ClickFunnels is the online-business version (and literally where
 * the "value ladder" language comes from). Reference, not templates to copy.
 */
export const GOLDEN_SAMPLES: GoldenSample[] = [
  {
    id: "mcdonalds",
    title: "McDonald's",
    subtitle: "The one everybody already knows — cheap food in, profit on the extras and the habit.",
    example: {
      insight: "The burger barely makes money — some items are sold at or below cost on purpose. The real profit is in the fries and drink almost everyone adds, the near-free refill, and the simple fact that a cheap, familiar meal pulls you back several times a week for years.",
      ladder: [
        { stage: "Driving product", name: "The $1 / value-menu item", price: "~$1", role: "Dirt-cheap and familiar — its only job is to be an easy yes that gets you through the door; it doesn't need to make a cent on its own." },
        { stage: "Core offer", name: "The combo meal (fries + drink)", price: "~$8", role: "The fries and drink almost everyone adds at the till — cheap to make, sold at a healthy margin, and where a $1 visit quietly becomes an $8 one." },
        { stage: "Profit engine", name: "Coming back + franchising", price: "A daily habit", role: "The soft drink (pennies of syrup for a couple of dollars), the habit of coming back, and the same system multiplied across tens of thousands of stores." },
      ],
      usp: "Fast, familiar, and exactly the same everywhere — for pocket change.",
      salesAngle: "Come in for the dollar menu; leave having bought the combo.",
      ad: "$1 gets you in the door. The fries are why you come back.",
      firstStep: "Pick one cheap, almost irresistible item that gets people in the habit of choosing you — then decide what your 'fries and drink' is: the higher-margin thing you offer every one of them.",
    },
    adapt: "Make it yours: your driving product is whatever a first-time buyer can say yes to without thinking — a $7 guide, a cheap trial, a paid sample. Your 'fries and drink' is the one higher-margin thing you offer every buyer at the point of sale. Your 'coming back' is the reason they return next week. Name those three for your business and you have the whole strategy.",
  },
  {
    id: "clickfunnels",
    title: "ClickFunnels",
    subtitle: "The online version — a free book leads to software, leads to high-ticket coaching.",
    example: {
      insight: "The free book isn't the business — it barely breaks even after shipping, on purpose. The business is the $97/mo software it sells you into and the high-ticket coaching, events and certification behind that, where nearly all the profit lives.",
      ladder: [
        { stage: "Driving product", name: "A free book (just pay shipping)", price: "Free + ~$8 ship", role: "Turns a stranger into a buyer for the price of shipping — and while they read it, it teaches them they need funnels, so the paid software becomes the obvious next step." },
        { stage: "Core offer", name: "The funnel software subscription", price: "$97–$297/mo", role: "The recurring product the book was quietly selling all along — billed every month, so one reader becomes years of revenue." },
        { stage: "Profit engine", name: "Coaching, events & certification", price: "$2k–$25k", role: "Coaching, live events and certification sold to the committed few — a handful of $2k–$25k sales outweigh thousands of book readers, and most of the profit lives here." },
      ],
      usp: "Get the playbook free — then build funnels that sell for you.",
      salesAngle: "The exact strategies in this book, free. You just cover shipping.",
      ad: "I'll send you my funnel playbook free — you only cover shipping.",
      firstStep: "Create one free or near-free lead product that naturally points to your paid thing — then make sure using it makes buying the next step feel obvious, not salesy.",
    },
    adapt: "Make it yours: your 'free book' is any near-free thing that both proves you can help and makes your paid offer the obvious next move — a template, a mini-course, a free audit. Your 'software' is your core recurring or main offer. Your 'coaching' is the high-ticket, done-with-you version for the few who want more. Draw that ladder once and every ad, email and page just points up it.",
  },
  {
    id: "coach",
    title: "A fitness coach",
    subtitle: "Closer to home — how a solo expert runs the same play with a free plan, a membership, and 1:1.",
    example: {
      insight: "No single session is the business. A free win earns trust, the monthly membership is steady income, and a few 1:1 clients carry the margin.",
      ladder: [
        { stage: "Driving product", name: "Free 7-day starter plan", price: "Free", role: "A no-risk taste of your coaching that gets someone training with you and seeing a quick win — you eat the ad cost to start the relationship." },
        { stage: "Core offer", name: "The monthly coaching membership", price: "$79/mo", role: "Workouts, check-ins and a community billed every month — the thing most clients stay on, and where the steady, predictable revenue comes from." },
        { stage: "Profit engine", name: "1:1 coaching & transformation packages", price: "$300–$1,500", role: "Hands-on, done-with-you coaching for the committed few — a handful of these outweigh dozens of memberships, and it's where the real margin lives." },
      ],
      usp: "Real coaching in your pocket — start free, get a result, upgrade when you're ready.",
      salesAngle: "Try my 7-day starter plan free. If it works, the membership keeps it going.",
      ad: "Grab my free 7-day starter plan — see a result this week, on me.",
      firstStep: "Package one small, genuinely useful free win, then design the paid membership it naturally leads into.",
    },
    adapt: "Make it yours: your 'free plan' is a small, real result you can give away to prove you're worth paying — an audit, a template, a first session. Your 'membership' is the repeatable core offer clients stay on. Your '1:1' is the premium, done-with-you tier for the few who want you closest. Even a pure service runs on a ladder, not a single price.",
  },
];

export const GOLDEN_SYSTEM =
  "You are a direct-response strategist. Teach ONE strategy by example: the 'value ladder' / loss-leader model that McDonald's, Amazon and every smart business runs. A cheap or free DRIVING PRODUCT gets the customer in the door (it can even lose money); the CORE OFFER is the main thing they came to buy; and the PROFIT ENGINE — the upsell, the continuity, the repeat purchase, the back end — is where the real money is made. " +
  "Given a specific business, produce a concrete WORKED EXAMPLE of exactly what THIS founder would do — real product names, real-ish prices, in their world. Never generic, never a template with blanks. Then write the USP, the sales-page angle and one short ad, all telling that one story. Prices are plain strings like \"Free\", \"$7\", \"$1,500\", \"$99/mo\". Keep every line tight and specific to their business; never invent facts about results or credentials. " +
  'Respond with ONLY minified JSON, no preamble or fences: {"insight":"","ladder":[{"stage":"Driving product","name":"","price":"","role":""},{"stage":"Core offer","name":"","price":"","role":""},{"stage":"Profit engine","name":"","price":"","role":""}],"usp":"","salesAngle":"","ad":"","firstStep":""}.';

/** Build the worked-example prompt from the saved offer + message. */
export function buildGoldenPrompt(offer: OfferData | null | undefined, m: MessageInput | null | undefined, strategy = ""): string {
  const lines: string[] = [];
  if (strategy.trim()) lines.push(`BUSINESS STRATEGY (build the value ladder to serve this goal and relieve the growth constraint):\n${strategy.trim()}`);
  if (offer?.name?.trim()) lines.push(`Offer: ${offer.name.trim()}`);
  if (offer?.promise?.trim()) lines.push(`The result they get: ${offer.promise.trim()}`);
  if (offer?.audience?.trim()) lines.push(`Who it's for: ${offer.audience.trim()}`);
  if (offer?.price?.trim()) lines.push(`Current price: ${offer.price.trim()}`);
  if (offer?.edge?.trim()) lines.push(`What makes us different: ${offer.edge.trim()}`);
  const ol = composeOneLiner(m?.oneLiner);
  if (ol) lines.push(`Business one-liner: ${ol}`);
  if (m?.character?.trim()) lines.push(`Customer: ${m.character.trim()}`);
  const ctx = lines.length ? lines.join("\n") : "A general small-business service with one main offer and no clear back end yet.";
  return `${ctx}\n\nShow me exactly what I would do — my driving product, core offer and profit engine, then the USP, sales angle and ad. Make it specific to this business.`;
}

/**
 * A compact strategy brief drawn from a saved worked example, for injecting
 * into OTHER generators (outreach, content, sell-better, sales page) so every
 * asset tells the same loss-leader / value-ladder story. Returns "" when there's
 * no usable example — callers simply append nothing and behave as before.
 */
export function strategyContext(g: GoldenExample | null | undefined): string {
  if (!g || !Array.isArray(g.ladder) || g.ladder.length === 0) return "";
  const driving = g.ladder[0]!;
  const profit = g.ladder[g.ladder.length - 1]!;
  const drivingName = driving.name || driving.stage;
  const profitName = profit.name || profit.stage;
  const parts: string[] = [
    `Overall strategy — keep this asset consistent with it: lead with a low-friction way in (${drivingName}) to start the relationship, and make the real profit on the back end (${profitName}).`,
  ];
  if (g.usp) parts.push(`Core USP: ${g.usp}`);
  if (g.insight) parts.push(`Key insight: ${g.insight}`);
  return parts.join("\n");
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

/** Parse the ladder array: each rung needs at least a name; stage/price/role optional. Cap 4. */
function parseLadder(v: unknown): LadderRung[] {
  if (!Array.isArray(v)) return [];
  const out: LadderRung[] = [];
  for (const it of v) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const name = clip(r.name, 120);
    const stage = clip(r.stage, 60);
    if (!name && !stage) continue;
    out.push({ stage, name, price: clip(r.price, 40), role: clip(r.role, 200) });
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Sanitise a plain object into a clean GoldenExample (clipped, capped ladder).
 * Returns null when there's no usable ladder — the ladder is the heart of the
 * example, so without it there's nothing worth storing or showing. Shared by
 * the parser and the persistence layer so both trust the same shape.
 */
export function sanitizeGoldenExample(v: unknown): GoldenExample | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const ladder = parseLadder(o.ladder);
  if (ladder.length === 0) return null;
  return {
    insight: clip(o.insight, 300),
    ladder,
    usp: clip(o.usp, 300),
    salesAngle: clip(o.salesAngle, 600),
    ad: clip(o.ad, 600),
    firstStep: clip(o.firstStep, 300),
  };
}

/**
 * Parse an AI worked-example reply into a clean GoldenExample. Tolerates fences
 * and surrounding prose. Returns null when the reply has no usable ladder.
 */
export function parseGoldenExample(reply: string): GoldenExample | null {
  const cleaned = stripFences(reply);
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  return sanitizeGoldenExample(parsed);
}
