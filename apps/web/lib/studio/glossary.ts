/**
 * Plain-language glossary — OneVYRT is for owners who sell, not for marketers
 * who already speak the jargon. Every term the app uses (persuasion, viability,
 * contribution margin, positioning, break-even…) gets a one-line meaning, a
 * fuller plain explanation, and — where it helps — why it matters to them.
 *
 * Pure and server-free: the data + lookup live here so the <Explain> chip, the
 * /glossary page and unit tests share one source of truth. Written in the app's
 * own voice: no hedging, no "simply", concrete over clever.
 */

export interface GlossaryEntry {
  /** Canonical display term. */
  term: string;
  /** One line, plain: what it means. */
  short: string;
  /** 1–3 sentences a non-technical owner can act on. */
  plain: string;
  /** Optional: why it matters / what to do about it. */
  why?: string;
  /** Other names or lookup keys that resolve to this entry. */
  aliases?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  // — The three pillar scores —
  {
    term: "Persuasion score",
    short: "How ready your selling is, out of 100.",
    plain: "A single number for how strong your selling foundation is right now — built from your Message, your Offer, your Positioning and your Presentation. Higher means a stranger is more likely to understand and want what you sell.",
    why: "It points you at the one thing that would lift it most, so you always know what to work on next.",
    aliases: ["persuasion", "persuasion readiness"],
  },
  {
    term: "Viability",
    short: "Whether the numbers actually work.",
    plain: "A read on whether your business makes money on each sale, based on your price and what it costs you to deliver. If every sale loses money, no amount of selling fixes it — that's what this catches.",
    why: "Sell hard on a viable offer; fix the economics first if it isn't.",
    aliases: ["viability score", "viable"],
  },
  {
    term: "Execution readiness",
    short: "How far your acquisition machine actually runs.",
    plain: "Tracks the real milestones from idea to income: a funnel exists, it's getting leads, those leads qualify, and calls get booked. Each one reached moves the score up.",
    aliases: ["readiness", "execution"],
  },

  // — Psychology / offer —
  {
    term: "Positioning",
    short: "Who it's for, and why you over the alternative.",
    plain: "The choice of who you're for and what makes you the better option than whatever they'd otherwise do. Strong positioning makes every other word land harder because it's aimed at one specific person.",
    why: "Vague positioning ('for everyone') is weak positioning. Name the buyer and the alternative you beat.",
  },
  {
    term: "Offer",
    short: "The specific thing you sell and its terms.",
    plain: "Not just your service — the whole package: a named thing, a clear promise, what's included, the price and its framing, a guarantee, and answers to the top objections. A sharp offer is easy to say yes to.",
    aliases: ["the offer"],
  },
  {
    term: "Promise",
    short: "The specific result they walk away with.",
    plain: "The concrete outcome a customer gets — not what your thing is, but what changes for them. 'A funnel that books calls in 14 days' beats 'funnel consulting'.",
  },
  {
    term: "Deliverables",
    short: "What's actually included — the value stack.",
    plain: "The list of concrete things a buyer receives. Stacking three or more makes the value obvious at a glance and justifies the price.",
    aliases: ["value stack", "deliverable"],
  },
  {
    term: "Price anchor",
    short: "What it's worth, shown next to the price.",
    plain: "A reference point — what the result is worth, or what it would otherwise cost — placed near your price so the price feels like a deal instead of a number in a vacuum.",
    aliases: ["anchor", "price framing"],
  },
  {
    term: "Guarantee",
    short: "Reversing the risk so saying yes is safe.",
    plain: "A promise that takes the risk off the buyer — a refund, a result, or a redo if it doesn't work. Reversing risk near the point of decision lifts conversions more than almost anything else.",
    aliases: ["risk reversal"],
  },
  {
    term: "Objection",
    short: "The doubt that stops the sale.",
    plain: "The real reason someone hesitates — 'too expensive', 'tried it before', 'no time'. Answering the top two or three before they're even asked removes the friction that kills sales.",
    aliases: ["objections"],
  },
  {
    term: "One-liner",
    short: "Your whole pitch in one sentence.",
    plain: "A single sentence that names the problem, your solution and the result. It's the spine everything else grows from — headlines, funnel intros, follow-up emails.",
    aliases: ["one liner", "storybrand one-liner", "storybrand"],
  },

  // — Numbers / economics —
  {
    term: "Contribution margin",
    short: "The share of each sale that's profit toward your costs.",
    plain: "Out of every sale, the part left after the direct cost of delivering it — shown as a percentage. A 60% margin means 60 cents of every dollar goes toward covering your fixed costs and, after that, profit.",
    why: "Higher margin means fewer sales needed to make money. If it's thin, raise the price or cut the delivery cost.",
    aliases: ["margin", "contribution"],
  },
  {
    term: "Contribution per unit",
    short: "The profit each single sale adds.",
    plain: "Your price minus what it costs to deliver one sale. It's the money each sale contributes toward your fixed costs — and, once those are covered, straight profit.",
  },
  {
    term: "Break-even",
    short: "How many you must sell to stop losing money.",
    plain: "The number of sales where your total profit-per-sale finally covers your fixed costs for the period. Below it you're losing money; above it you're making it.",
    why: "Knowing the number turns 'am I okay?' into a clear target you can plan traffic and pricing around.",
    aliases: ["break even", "break-even point", "breakeven"],
  },
  {
    term: "Margin of safety",
    short: "How far sales can drop before you're in the red.",
    plain: "The gap between what you sell now and your break-even point. A big margin of safety means a slow month won't sink you; a small one means you're running close to the line.",
  },
  {
    term: "Profit goal",
    short: "The profit you want — turned into a sales target.",
    plain: "Tell the tool how much profit you want for the period and it works out how many you must sell to get there (your fixed costs plus that profit, divided by the profit per sale).",
  },
  {
    term: "Fixed costs",
    short: "What you pay whether or not you sell.",
    plain: "The steady costs of being in business for the period — rent, software, salaries, subscriptions. They don't move with each sale, which is exactly why sales have to cover them.",
  },
  {
    term: "Variable cost",
    short: "What each extra sale costs you to deliver.",
    plain: "The cost tied to one sale — materials, payment fees, contractor time, cost of goods. It grows with volume, unlike fixed costs.",
    aliases: ["variable cost per unit", "cost per sale"],
  },

  // — Execution / acquisition —
  {
    term: "Funnel",
    short: "The path a stranger takes to becoming a lead.",
    plain: "The steps that turn a visitor into a qualified lead: a page that states the offer, a few questions that qualify them, and a next step (book a call, get a resource). In OneVYRT you build and score it before spending on traffic.",
  },
  {
    term: "Qualified lead",
    short: "A lead who's actually a fit to buy.",
    plain: "Not just anyone who filled in a form — someone whose answers show they match who your offer is for. Qualifying keeps your calendar full of the right conversations, not tire-kickers.",
    aliases: ["qualified", "qualify"],
  },
  {
    term: "Nurture",
    short: "Staying in touch with 'not yet' leads.",
    plain: "The follow-up for people who are a fit but didn't act yet — a helpful email, a resource, a check-in — so you're the obvious choice when they're ready.",
  },
  {
    term: "Close rate",
    short: "The share of sales conversations that become sales.",
    plain: "Out of every ten qualified people you actually talk to, how many buy? That percentage is your close rate. Multiply it back and it tells you how many conversations you need to hit a sales target.",
    why: "A higher close rate — from a sharper offer and better positioning — means fewer conversations to reach the same income.",
    aliases: ["conversion rate"],
  },
  {
    term: "Qualify rate",
    short: "The share of leads who turn out to be a fit.",
    plain: "Of the people who become a lead, how many actually match who your offer is for and are worth a real conversation. Your funnel's scoring decides this — a higher qualify rate means fewer wasted calls.",
    aliases: ["qualification rate"],
  },
  {
    term: "Opt-in rate",
    short: "The share of visitors who become a lead.",
    plain: "Of everyone who lands on your page, how many hand over their details (fill the form, start the funnel). A clear offer and a clean page lift it; a confusing one sinks it.",
    aliases: ["landing page conversion", "conversion rate (page)"],
  },
  {
    term: "Cost per visitor",
    short: "What you pay an ad platform for one click to your page.",
    plain: "If you buy traffic (Google, Meta, TikTok ads), each visitor costs something — often a dollar or a few. Multiply it by the visitors you need and you get the ad budget to hit your goal. Leave it blank if you're bringing traffic for free through outreach and content.",
    why: "It's the honest test of paid traffic: if the budget to buy enough visitors is bigger than the profit the goal makes, earn those visitors for free first.",
    aliases: ["cost per click", "cpc", "cost per visit"],
  },
  {
    term: "CAC",
    short: "What it costs to get one customer.",
    plain: "Customer Acquisition Cost — your spend divided by the customers it produced. Compare it to what a customer is worth to you: if CAC is below that, growth pays for itself.",
    aliases: ["customer acquisition cost", "cost per acquisition"],
  },

  // — The value-ladder strategy (Golden Examples) —
  {
    term: "Value ladder",
    short: "Offers that climb in price, each leading to the next.",
    plain: "Instead of one price, you offer a series — a cheap or free way in, then bigger, higher-value offers. Each step makes the next an easy yes. It's how McDonald's, Amazon and most durable businesses actually make their money.",
    why: "Most profit isn't on the first sale. A ladder lets you win a customer cheaply, then earn the real money on what comes after.",
    aliases: ["value ascension", "offer ladder"],
  },
  {
    term: "Loss leader",
    short: "Something sold cheap — even at a loss — to get people in the door.",
    plain: "A product priced below what it costs you, on purpose. It's not meant to make money itself; it's meant to start the relationship so the profitable offers behind it get their chance. The $1 McDonald's item and the free-shipping book are loss leaders.",
    why: "Paying to acquire a customer up front is fine if the back end more than earns it back. That's the whole game.",
    aliases: ["loss-leader"],
  },
  {
    term: "Driving product",
    short: "The cheap, irresistible offer that pulls people in.",
    plain: "The front of your value ladder — low-priced or free, designed to be an easy yes and get someone to buy from you the first time. The burger, the $7 book, the $1 razor. Often a loss leader.",
    why: "It's what you actually advertise and optimise. Make it an easy yes and the whole ladder behind it gets a chance; make it a hard sell and nothing behind it ever loads.",
    aliases: ["front-end offer", "lead product"],
  },
  {
    term: "Profit engine",
    short: "The back-end offer where you actually make money.",
    plain: "The rung of the ladder that carries the profit — the fries and drink, the monthly software, the high-ticket coaching, the refills. Cheap to sell to someone who's already bought once, and where the real margin lives.",
    why: "This is the number that decides whether the whole funnel works. If the back end earns more than the front loses, you can afford to outspend everyone to win customers.",
    aliases: ["back end", "back-end offer"],
  },
  {
    term: "Tripwire",
    short: "A small, low-risk paid offer that turns a lead into a buyer.",
    plain: "A cheap offer (often $7–$47) whose real job isn't the money — it's converting someone from 'interested' to 'has paid you once', because the second sale is far easier than the first.",
    why: "A buyer is worth far more than a lead. The tripwire crosses that line cheaply, so your real offers get sold to people who have already trusted you with their card.",
    aliases: ["tripwire offer"],
  },
  {
    term: "Order bump",
    short: "A small add-on offered right at checkout.",
    plain: "A tick-box extra on the payment page — 'add this for $X?'. Because the buyer's already deciding to pay, a good bump lifts the average order with almost no extra effort.",
    why: "It's the highest-leverage few words in the funnel — pure margin on a decision the buyer is already making, so a good bump can lift the average order with no extra traffic.",
    aliases: ["bump"],
  },
  {
    term: "Upsell",
    short: "A bigger or better offer made right after a purchase.",
    plain: "Once someone buys, you offer a larger version, a faster result, or a done-for-you option. They're at their most likely to say yes in the moment they've just bought, so this is where a lot of the profit is made.",
    why: "The moment just after 'yes' is when a customer is most willing to spend again. Skipping the upsell leaves the easiest money in the whole funnel on the table.",
    aliases: ["one-time offer", "oto"],
  },
  {
    term: "Continuity",
    short: "A recurring charge — the subscription that keeps paying.",
    plain: "Anything billed again and again: a membership, monthly software, a retainer. It turns one sale into predictable income, which is why so many value ladders end in continuity.",
    why: "Recurring income is predictable and compounds, so it's what makes a business steadier and worth more — one good continuity offer can carry the entire ladder.",
    aliases: ["recurring revenue", "subscription", "membership"],
  },

  // — AI setup —
  {
    term: "API key",
    short: "A password that lets OneVYRT use your own AI account.",
    plain: "A long secret code you copy from your AI provider (OpenAI, Anthropic/Claude, xAI or OpenRouter) and paste into Connections once. OneVYRT then uses it to write drafts for you. It's saved to your account (encrypted) so it works across your devices, and each request goes straight from your browser to the provider.",
    why: "A ChatGPT Plus or Claude Pro subscription is NOT the same thing — those are for chatting on their website. To power the app you need a separate developer API key from the provider's console (e.g. console.anthropic.com), which is usage-billed, often just cents per draft.",
    aliases: ["ai key"],
  },
  {
    term: "AI provider",
    short: "Which AI service writes your drafts.",
    plain: "The company whose AI OneVYRT calls when you press a 'Draft with AI' button — OpenAI (ChatGPT), Anthropic (Claude), xAI (Grok) or OpenRouter. You pick one in Connections and paste its API key. Pick 'Manual' to write everything yourself with no AI.",
    aliases: ["ai connection", "provider"],
  },
];

const norm = (s: string): string => s.trim().toLowerCase();

// Built once: every term and alias → its entry.
const INDEX: Map<string, GlossaryEntry> = (() => {
  const m = new Map<string, GlossaryEntry>();
  for (const e of GLOSSARY) {
    m.set(norm(e.term), e);
    for (const a of e.aliases ?? []) m.set(norm(a), e);
  }
  return m;
})();

/** Resolve a term or alias (case/space-insensitive) to its entry, or undefined. */
export function lookupTerm(key: string): GlossaryEntry | undefined {
  return INDEX.get(norm(key));
}

/** The glossary sorted A–Z by term, for the glossary page. */
export function glossarySorted(): GlossaryEntry[] {
  return [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
}
