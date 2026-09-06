/**
 * Chapter 4.3 — Improve Profit.
 *
 * Builds on 4.1/4.2: whatever the named constraint, profit is the fuel every
 * other improvement in this chapter needs to be worth doing. This is also
 * where the learner writes down the current-vs-target metric pair (revenue,
 * margin, or customer value) that 4.5 turns into the Growth & Improvement
 * Plan's headline numbers.
 *
 * Maps to the engine's "m-improve-profit" canonical lesson id (see
 * packages/engine/src/curriculum-chapters.ts's chapter-4 stage) — see this
 * directory's index.ts for how the two are linked.
 */
import type { ActionItem } from "./types";

export const title: string = "Improve Profit";

export const description: string =
  "Revenue is what everyone talks about; profit is what actually pays you. It's entirely possible to grow revenue every year and take home less each time, because costs grew to match, or discounts crept in, or the customers you added were less profitable than the ones you started with. This subchapter is about protecting and growing what you actually keep — because if profit isn't the constraint you named in 4.1, it's still the fuel every other improvement in this chapter needs to be worth doing.\n\n" +
  "There are really only four ways to make a business more profitable, and most owners only ever pull one of them.\n\n" +
  "Price: a small increase in price goes almost straight to profit, because your costs to deliver don't change — a 5% price rise on a product with 30% margin can lift profit by close to 15-20%, something you'd need a much larger jump in sales volume to match. Most small businesses are underpriced relative to the value they deliver, usually because the price hasn't been revisited since the business started and fear of losing customers has quietly capped it ever since.\n\n" +
  "Cost of delivery: what does it actually cost — time, materials, subcontractors, refunds, rework — to deliver one sale? Costs creep in unnoticed: a supplier's price goes up and nobody re-quotes, scope quietly expands beyond what was priced, or a tool subscription outlives its usefulness. A margin review most owners haven't done in over a year usually turns up more than one of these.\n\n" +
  "Volume and mix: not all sales are equally profitable — some products, services or customer types make you far more than others for the same effort. Selling more of your most profitable offer, or deliberately steering new inquiries toward it, raises average profit without raising total effort.\n\n" +
  "Customer value: the cheapest sale is the one to someone who already bought from you. A customer who buys once versus a customer who buys three times, refers a friend, or upgrades to a higher tier is worth multiples more for the same acquisition cost — yet most businesses spend all their attention getting a first sale and almost none on the second.\n\n" +
  "Before choosing which lever to pull, find your leaks. Look honestly at: how often you discount, and whether it's a strategy or a habit; whether the scope of what you deliver has quietly grown beyond what the price covers; whether every customer is actually profitable, or a loud, demanding minority is eating the margin the rest of the business earns; and whether subscriptions, tools or overhead have crept up without a corresponding increase in what they produce.\n\n" +
  "This is also where the baseline gets written down for real. Chapter 3 gave you your current revenue, margin and customer value — this subchapter is where you decide what they should become. Pick the one or two profit numbers most connected to your constraint, write down exactly where they stand today, and set a specific, defensible target for 90 days from now. That current-versus-target pair is what feeds directly into your Growth & Improvement Plan in 4.5 — and it's the same pair your coach will check you against when this chapter comes up for review.";

export const keyPoints: string[] = [
  "Revenue is vanity, profit is what pays you — growing revenue while margin shrinks can leave you worse off.",
  "There are only four profit levers: price, cost of delivery, volume/mix, and customer value — most owners only ever pull one.",
  "A small price increase usually lifts profit far more than the same percentage increase in sales volume.",
  "Profit leaks hide in habitual discounting, scope creep, unprofitable customers, and creeping overhead.",
  "The cheapest sale is the next one to an existing customer — customer value is the most under-used lever.",
];

export const learningObjectives: string[] = [
  "Distinguish revenue growth from profit growth and explain why they can move in opposite directions.",
  "Identify which of the four profit levers (price, cost, volume/mix, customer value) has the most room to move in your business.",
  "Audit your own business for at least three common profit leaks.",
  "Set a specific current-vs-target figure for the profit metric most connected to your constraint.",
];

export const actionItems: ActionItem[] = [
  {
    title: "Run a profit-leak audit",
    description:
      "Check your business against four common leaks: habitual discounting, scope creep beyond what's priced, unprofitable customers, and creeping overhead/subscriptions. Note which apply.",
  },
  {
    title: "Test a price move on paper",
    description:
      "Calculate what a 5-10% price increase would do to your monthly profit at current volume, using your real margin — before deciding whether to act on it.",
  },
  {
    title: "Rank your offers or customer types by real profit",
    description:
      "List your main products, services or customer segments and rank them by actual margin, not revenue, to find where volume should be steered.",
  },
  {
    title: "Set your current and target profit metric",
    description:
      "Choose the one or two profit numbers (e.g. gross margin %, average customer value) most tied to your constraint, record today's figure, and set a specific 90-day target.",
  },
];
