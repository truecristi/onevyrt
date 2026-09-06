/**
 * The app-wide "define this term" glossary (Ch. shift-click definitions):
 * shift+click any element carrying `data-term="key"` and GlossaryLayer
 * (components/studio/GlossaryLayer.tsx) shows this entry in a popover.
 * Kept as one flat dictionary rather than scattering definitions next to
 * each render site, so the same key (e.g. "conversionRate") gives a
 * consistent answer everywhere it appears — the Inspector, Model Centre,
 * and a KPI card all mean the same thing by it.
 */

export type GlossaryCategory = "revenue" | "cost" | "rate" | "risk" | "volume" | "tool";

export const GLOSSARY_CATEGORY_COLOR: Record<GlossaryCategory, string> = {
  revenue: "#16a34a",
  cost: "#ea580c",
  rate: "#0891b2",
  risk: "#dc2626",
  volume: "#7c3aed",
  tool: "#1a73e8",
};
export const GLOSSARY_CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  revenue: "Revenue & profit",
  cost: "Cost",
  rate: "Rate",
  risk: "Risk",
  volume: "Volume",
  tool: "Feature",
};

export interface GlossaryEntry { label: string; category: GlossaryCategory; definition: string }

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // --- Engine field keys (traffic/step/offer/split), shared by the
  //     Inspector panel and Model Centre ---
  visitors: { label: "Visitors", category: "volume", definition: "How many people enter the funnel at this traffic block, per period. Everything downstream — passes, conversions, buyers — is a rate applied to this number, so getting this assumption honest matters more than almost anything else on the block." },
  costPerVisitor: { label: "Cost per visitor", category: "cost", definition: "What you pay, on average, to bring one visitor to this block — ad spend divided by visitors. Total cost scales with volume, so doubling visitors under this model doubles cost too, unlike a flat-cost block." },
  flatCost: { label: "Total cost (flat)", category: "cost", definition: "A fixed spend for this traffic source that doesn't change with visitor count — a flat retainer or sponsorship instead of a per-click cost. Useful for organic, referral, or contract-based channels where \"cost per visitor\" isn't really how the money works." },
  costModel: { label: "Cost model", category: "tool", definition: "Whether this traffic source is priced per visitor (scales with volume, like paid ads) or as a flat total cost (fixed regardless of volume, like a monthly retainer). Picking the wrong one for a channel will quietly distort every downstream cost calculation." },
  expenseAmount: { label: "Expense amount", category: "cost", definition: "A fixed dollar overhead attached to this block — tooling, fees, or labor that doesn't scale with volume, subtracted from profit regardless of throughput. Use this for costs that exist whether or not anyone actually converts here." },
  expenseRate: { label: "Expense rate", category: "cost", definition: "An overhead cost that scales with this block's volume, expressed as a rate rather than a flat number — the opposite of expense amount, for costs that genuinely grow with throughput (e.g. a per-order handling fee)." },
  passRate: { label: "Pass rate", category: "rate", definition: "The share of people entering this step who continue to the next one. The rest drop off here — this is the leak rate for the step, and a chain of low pass rates compounds fast, so it's usually worth checking each one individually rather than only the funnel-wide total." },
  conversionRate: { label: "Conversion rate", category: "rate", definition: "The share of visitors reaching this offer who actually buy. The single biggest lever on most funnels' revenue — a small improvement here typically moves profit more than an equivalent improvement in traffic cost." },
  price: { label: "Price", category: "revenue", definition: "What a buyer pays for the core offer, before order bumps, upsells, refunds, or fees are applied. Everything else on the offer (bumps, upsells, refund rate) is layered on top of this base number, not baked into it." },
  orderBumpRate: { label: "Order-bump take rate", category: "rate", definition: "The share of buyers who also accept the order-bump offered alongside the main purchase, at checkout, before they've completed the primary transaction." },
  orderBumpPrice: { label: "Order-bump price", category: "revenue", definition: "The price of the add-on offered at checkout, on top of the main purchase — typically small and low-friction, since it's competing with the buyer's attention right as they're already committing to pay." },
  upsellRate: { label: "Upsell take rate", category: "rate", definition: "The share of buyers who accept the upsell offered right after the main purchase, once the sale is already secured — a separate decision point from the order bump, with its own conversion economics." },
  upsellPrice: { label: "Upsell price", category: "revenue", definition: "The price of the post-purchase upsell offer — since trust is highest right after a completed purchase, this can usually carry a meaningfully higher price than the order bump." },
  recurringRate: { label: "Recurring take rate", category: "rate", definition: "The share of buyers who opt into the recurring/subscription component of this offer, converting a one-time sale into an ongoing relationship that feeds MRR." },
  monthlyPrice: { label: "Monthly price", category: "revenue", definition: "What a subscriber pays each month once they're on the recurring plan — this is what drives MRR, and combined with churn rate, drives LTV." },
  churnRate: { label: "Monthly churn", category: "rate", definition: "The share of subscribers who cancel in a given month. Higher churn shortens average subscriber lifetime and lowers LTV — even a small churn increase compounds badly over a year of subscribers." },
  unitCost: { label: "Unit cost", category: "cost", definition: "What it costs you to fulfill one unit sold — product, shipping, or delivery cost, subtracted from revenue to get gross profit. This is a per-sale cost, distinct from the traffic cost it took to generate the sale in the first place." },
  refundRate: { label: "Refund rate", category: "rate", definition: "The share of sales that get refunded. Refunded revenue (and any merchant fees on it) is subtracted from what you actually keep — a high refund rate can quietly turn an apparently-profitable offer unprofitable." },
  merchantFeeRate: { label: "Merchant fee", category: "cost", definition: "The payment processor's cut of each sale (e.g. card processing fees), taken off the top of revenue you keep — small per transaction, but worth including honestly since it applies to every single sale without exception." },
  yesRate: { label: "Yes rate", category: "rate", definition: "At a split/decision block, the share of people who take the \"yes\" branch. Everyone else takes the other path — useful for modeling any binary fork in the journey, not just literal yes/no questions." },
  delayDays: { label: "Delay before next step", category: "tool", definition: "How many days typically pass before someone who reaches this block moves to the next one — used for timeline/cohort modeling, not the funnel math itself, so it won't change PLAN totals but will change when Timeline shows them landing." },
  variantPrice: { label: "Variant price", category: "revenue", definition: "The price of this specific item in a multi-price ladder (e.g. one SKU among several offered at this block) — each variant can carry its own price independent of the others." },
  variantShare: { label: "Variant sales share", category: "rate", definition: "What portion of buyers at this block choose this particular variant, out of all active variants (normalized to 100% across the ladder) — this is what weighted price is computed from." },

  // --- Computed stat boxes (Inspector) ---
  totalCostStat: { label: "Total cost", category: "cost", definition: "The actual dollar cost this traffic block incurs this period, computed from visitors × cost-per-visitor (or the flat cost, if that model is selected) — a derived number, not something you enter directly." },
  incomingStat: { label: "Incoming", category: "volume", definition: "How many people this block actually sends downstream — visitors after any block-level drop-off is applied, i.e. what the next block in the chain actually receives as its own visitor count." },
  actualVisitors: { label: "Actual visitors", category: "volume", definition: "The real number of people this block got last period, entered from your ad platform or analytics — so you can compare what actually happened against the plan's assumption and see where reality diverged." },
  actualSpend: { label: "Actual spend", category: "cost", definition: "The real dollars you actually spent on this block last period, from your ad account — compared against the planned cost so you can tell whether you over- or under-spent to hit the traffic you got." },
  actualBuyers: { label: "Actual buyers", category: "volume", definition: "The real number of people who bought here last period — the honest conversion outcome to check against the rate your plan assumed, so your next projection is grounded in what really converts." },
  actualRevenue: { label: "Actual revenue", category: "revenue", definition: "The real money this block brought in last period, before costs — compared against the planned revenue so you can see whether price, volume, or conversion is where the plan and reality drift apart." },
  weightedPrice: { label: "Weighted price", category: "revenue", definition: "The average price a buyer pays here, weighted by each price variant's share of sales — one number that summarizes a whole price ladder, useful for comparing this block against a single-price offer elsewhere in the funnel." },
  refundLoss: { label: "Refund loss", category: "cost", definition: "Revenue given back due to refunds at this block's refund rate — money you collected but didn't keep, shown separately from merchant fees since the two erode profit for different reasons." },
  merchantFees: { label: "Merchant fees", category: "cost", definition: "What the payment processor keeps from this block's sales, after refunds, before you see the rest — the actual dollar amount, computed from the merchant fee rate applied to post-refund revenue." },
  netPerSale: { label: "Net per sale", category: "revenue", definition: "What's actually left from one sale after refunds, merchant fees, and unit cost — the real per-unit profit, not just the sticker price. This is the number that should drive your maximum-affordable-CPA thinking, not price alone." },
  revenue: { label: "Revenue", category: "revenue", definition: "Total money collected from buyers, before costs, fees, or refunds are subtracted — the top-line number, not the profit number; see gross profit for what's actually left after costs." },

  // --- KPI cards (Command Centre / canvas KPI row) ---
  buyers: { label: "Buyers", category: "volume", definition: "How many visitors converted all the way to a purchase, across the whole funnel — the number every conversion rate along the path ultimately compounds down to." },
  totalCost: { label: "Total cost", category: "cost", definition: "Everything spent to run the funnel this period — traffic acquisition cost plus any per-block expenses — the denominator behind ROAS and a direct input into gross profit." },
  grossProfit: { label: "Gross profit", category: "revenue", definition: "Revenue minus total cost. The headline number for whether this funnel makes money, before overhead outside the funnel itself (staff, rent, tools not modeled as a block expense)." },
  roas: { label: "ROAS", category: "rate", definition: "Return on ad spend — revenue divided by traffic cost. A ROAS of 2x means every $1 spent on traffic returned $2 in revenue, though that's revenue, not profit — check margin alongside it before calling a ROAS \"good.\"" },
  cpa: { label: "CPA", category: "cost", definition: "Cost per acquisition — total traffic cost divided by buyers. What it actually costs, all-in, to win one customer — compare this against net per sale to see whether each customer is actually worth acquiring at this cost." },
  aov: { label: "AOV", category: "revenue", definition: "Average order value — revenue divided by buyers. What a typical customer spends per purchase, including bumps and upsells — a funnel can raise AOV without touching traffic or conversion at all, purely through better bump/upsell offers." },
  mrr: { label: "MRR", category: "revenue", definition: "Monthly recurring revenue — the predictable revenue you'd expect every month from active subscribers, separate from one-time purchase revenue. This is the number that compounds (or erodes) based on new signups versus churn." },
  arr: { label: "ARR", category: "revenue", definition: "Annual recurring revenue — MRR × 12. A yearly view of the same predictable subscription revenue, useful for comparing against annual costs or targets rather than monthly ones." },
  ltv: { label: "LTV", category: "revenue", definition: "Lifetime value — the total revenue you can expect from a customer over their whole relationship with you, driven by monthly price and churn rate. The other half of the LTV:CAC comparison that determines whether growth spend is actually sustainable." },
  cac: { label: "CAC", category: "cost", definition: "Customer acquisition cost — what it costs, all-in, to acquire one paying customer. Compare against LTV: a healthy business needs LTV well above CAC, commonly cited as at least 3x, though the right ratio depends on how fast you need to recover that cost in cash." },

  // --- Risk panel ---
  margin: { label: "Margin", category: "rate", definition: "Gross profit as a share of revenue. Higher margin means more of every dollar collected turns into profit — two funnels with identical revenue can have very different margins depending on cost structure, so revenue alone never tells the full story." },
  breakEvenTraffic: { label: "Break-even traffic", category: "risk", definition: "How much traffic volume could drop before this plan stops being profitable — expressed as a percentage of your current traffic assumption. A low number here means the plan has almost no cushion if traffic underperforms." },
  worstLikelyBest: { label: "Worst / likely / best case", category: "risk", definition: "A range of outcomes if your traffic and conversion assumptions swing up or down together by the shown spread — not a guarantee, a sense of how sensitive the plan is. A wide gap between worst and best usually means the plan is resting on a small number of shaky assumptions." },

  // --- Tools Hub tiles ---
  launchChecklist: { label: "Launch checklist", category: "tool", definition: "A running list of things that need to be true before this funnel goes live — tracking installed, offer reviewed, checkout tested — a final sanity pass rather than a substitute for actually testing the funnel yourself." },
  riskAssessment: { label: "Risk assessment", category: "risk", definition: "An automatic read on how fragile this plan is — margin, break-even traffic, and which assumptions matter most if they're wrong — computed from the same PLAN numbers everywhere else in the studio, not a separate manual entry." },
  constraints: { label: "Constraints", category: "tool", definition: "Hard limits you set on the plan — a budget cap, a capacity limit, or a CPA/ROAS threshold — checked against the current numbers, so you're told when a plan crosses a line you set, rather than having to notice it yourself." },
  notesFeature: { label: "Notes", category: "tool", definition: "Free-form notes attached to this project, for context that doesn't fit anywhere else in the model — decisions, caveats, or reminders for your future self or teammates." },
  versionHistory: { label: "Version history", category: "tool", definition: "Every saved snapshot of this project, so you can see what changed over time or roll back to an earlier version — useful both for tracking how the plan evolved and for undoing a change that turned out to be wrong." },
  activityFeed: { label: "Activity feed", category: "tool", definition: "A log of who did what in this workspace — saves, member changes, workspace renames — the shared record of what happened, especially useful once more than one person has access." },
  peopleJourneys: { label: "People journeys", category: "tool", definition: "A per-visitor view of the path someone actually took through the funnel, once the tracking snippet is live on your pages. This is real ACTUAL data, not a PLAN projection — it only exists once tracking is actually recording visits." },
  retargetingLoops: { label: "Retargeting loops", category: "tool", definition: "Models people who said \"no\" at one block getting looped back in via retargeting, with some decayed chance of converting on a later attempt — captures the real-world fact that a \"lost\" visitor isn't always gone for good." },
  recurringRevenue: { label: "Recurring revenue", category: "revenue", definition: "The MRR/ARR/LTV/CAC view of the plan — everything about subscription economics in one place, separate from the one-time-purchase numbers shown elsewhere." },
  timeline: { label: "Timeline", category: "tool", definition: "How the plan plays out over time, accounting for the delay-before-next-step set on each block — cohorts and follow-up sequences, not just steady-state totals. Useful for seeing when revenue actually lands, not just how much." },
  aiCopilot: { label: "AI Copilot", category: "tool", definition: "A chat assistant that can see this plan's numbers and answer questions about it, using your own AI provider key. Your key is saved to your account (encrypted) so it works across your devices, and each request goes straight from your browser to the provider — ONEVYRT never proxies your AI calls." },
  integrations: { label: "Integrations", category: "tool", definition: "Webhook receivers for events pushed to you (like Stripe), API keys for pulling your data out, and outbound webhooks for pushing your own events to other tools — the plumbing for connecting this project to the rest of your stack." },
  guidedTour: { label: "Guided tour", category: "tool", definition: "A walkthrough of the studio's main pieces, for getting oriented on your first project — a one-time orientation, not something you need to revisit once you know your way around." },

  // --- Loop stages ---
  stagePlan: { label: "PLAN", category: "tool", definition: "Build the model: add blocks, set assumptions, see what the plan predicts before anything real has happened. Every number here is a projection until ACTUAL data starts confirming or contradicting it." },
  stageActual: { label: "ACTUAL", category: "tool", definition: "Log what really happened — real visitors, spend, buyers, revenue — separate from the PLAN assumptions, so the two can be compared honestly instead of quietly blending into each other." },
  stageReview: { label: "REVIEW", category: "tool", definition: "Compare actual results against the plan, block by block, to see where reality drifted and by how much — this is where you find out which of your PLAN assumptions were actually wrong, and by how much." },
  stageSimulate: { label: "SIMULATE", category: "tool", definition: "Test a hypothetical change against the current plan without touching it — a what-if candidate versus baseline, so you can see the projected effect of a change before committing to it for real." },
  stageDecide: { label: "DECIDE", category: "tool", definition: "Commit to a change and log the decision — what you're changing, why, and what you expect to happen — so you can measure it later and check whether it actually delivered what you expected." },

  // --- Tool modes ---
  businessIntelligence: { label: "Business Intelligence", category: "tool", definition: "The narrative layer behind the numbers — who you serve, what you sell, why it should work — kept separate from the canvas's raw math, so the reasoning behind a plan is written down somewhere, not just implied by the numbers." },
  modelCentre: { label: "Model", category: "tool", definition: "Every block's editable assumptions laid out in one flat list, instead of clicking into each block individually — faster for adjusting several assumptions at once or getting a full picture of everything the plan depends on." },
  savedScenarios: { label: "Saved Scenarios", category: "tool", definition: "Named what-if variants you've saved for later comparison — distinct from SIMULATE's one-off candidate-vs-baseline check, these persist so you can compare several named variants side by side, not just one at a time." },
  goalSolver: { label: "Goal Solver", category: "tool", definition: "Pick a target number (like a revenue goal) and let it work backward to tell you what a specific input would need to be to hit it — useful for turning \"I want £50k/month\" into \"I need this conversion rate\" instead of guessing." },
};
