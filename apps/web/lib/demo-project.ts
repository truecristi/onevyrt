/**
 * Free-plan demo: a single, fully-populated, read-only funnel shown instead
 * of a real (empty) library. The point is to let a free user see every part
 * of the product filled in and working — canvas, program, reports — without
 * being able to change or save anything. Nothing here is persisted; it's
 * applied straight into local state via applyDoc() and never round-trips
 * through the server.
 */
import type { FunnelDoc } from "@onevyrt/engine";

const DEMO_CREATED = "2026-06-01T09:00:00.000Z";

export const DEMO_DOC: FunnelDoc = {
  version: 1,
  name: "Demo — Coaching Program Funnel",
  currency: "USD",
  nodes: [
    { id: "traffic", kind: "traffic", label: "Facebook Ads", x: 40, y: 140, visitors: 6000, costPerVisitor: 180, costModel: "perVisitor" },
    { id: "landing", kind: "step", label: "Landing Page", x: 320, y: 140, passRate: 0.38 },
    { id: "sale", kind: "offer", label: "Coaching Program", x: 600, y: 140, conversionRate: 0.14, price: 149700, orderBumpRate: 0.22, orderBumpPrice: 4700, upsellRate: 0.11, upsellPrice: 99700 },
  ],
  edges: [
    { id: "e1", source: "traffic", target: "landing" },
    { id: "e2", source: "landing", target: "sale" },
  ],
  actuals: {
    traffic: { visitors: 5820, cost: 1047600 },
    landing: {},
    sale: { buyers: 289, revenue: 43254300 },
  },
  decisions: [
    {
      id: "dec1", createdAt: "2026-06-10T14:00:00.000Z",
      problem: "Order bump take-rate was healthy but priced well below what buyers were willing to pay.",
      hypothesis: "Raising the order bump price 20% won't meaningfully hurt take-rate.",
      move: "Raised the order bump from $39 to $47.",
      reason: "Buyers at this price point over-index on trust, not price sensitivity.",
      expectedImpact: "+$1,200/mo in order bump revenue with take-rate holding above 20%.",
      confidence: "medium", owner: "Founder", dueDate: "2026-06-24",
      linkedNodeId: "sale", status: "measured",
      measurement: { baseline: 0.19, expected: 0.2, observed: 0.22, outcome: "hit", learning: "Price wasn't the objection — clarity of what's included was.", measuredAt: "2026-06-24T10:00:00.000Z" },
    },
  ],
  expenses: { amount: 50000, rate: 0 },
  period: { start: "2026-06-01", end: "2026-06-30" },
  riskRegister: [
    { id: "risk1", createdAt: DEMO_CREATED, label: "Single traffic source", description: "All paid traffic runs through one ad account — a policy flag would stop new leads overnight.", severity: "high", status: "open", linkedNodeId: "traffic" },
    { id: "risk2", createdAt: DEMO_CREATED, label: "Refund exposure on the upsell", description: "Upsell has no guarantee page yet, so refund rate is unproven.", severity: "medium", status: "mitigated", resolution: "Added a 14-day guarantee to the upsell page." },
  ],
  checklist: [
    { id: "chk1", text: "Tracking pixel firing on every step", done: true, createdAt: DEMO_CREATED, doneAt: DEMO_CREATED },
    { id: "chk2", text: "Order bump copy reviewed by legal", done: true, createdAt: DEMO_CREATED, doneAt: DEMO_CREATED },
    { id: "chk3", text: "Checkout tested on mobile", done: false, createdAt: DEMO_CREATED },
  ],
  notes: "Objective: prove the coaching offer can hold a 2x+ ROAS at $180 CPV before scaling spend past $2k/day.",
  program: {
    definition: {
      businessName: "Northline Coaching",
      whoServe: "Service-business owners stuck doing $10-30k/mo who want a real team, not more hustle.",
      mainOffer: "12-week 1:1 + group coaching program that rebuilds the business's systems from the ground up.",
      currentReality: "Founder is the bottleneck for sales, delivery, and hiring — growth stalls whenever they take a week off.",
      breakthrough: "Every system in the business needs to run without the founder in the room, not just fewer hours per week.",
      vision: "A business that runs on documented systems and a small trained team, doing $2M/yr with the founder working 25 hours/week.",
      milestones: "Hire and fully onboard an operations lead; document the top 5 recurring workflows; hit $80k months without the founder closing sales personally.",
      mainConstraint: "No documented systems — everything lives in the founder's head.",
      mainOpportunity: "Existing clients refer constantly but there's no structured referral ask, so it's happening by accident.",
      currentState: "We're the business that's always one bad week away from falling apart, because nothing works without me.",
      currentStory: "I'm the only one who can do this right, so I have to stay hands-on everything.",
      newStory: "I build the systems once, train the team to run them, and my job is steering — not doing.",
      strategy: "Document one workflow per week, hand it off, and only step back in when a client actually asks for the founder by name.",
      weeklyFocus: "Write down the sales-call script that's only ever existed in my head.",
    },
    forceActions: [
      { id: "fa1", force: 1, principle: "Know the real map of the business, not the one on paper.", actionItem: "Diagram every step a lead actually goes through, including the ones nobody admits exist.", dollarValue: 0, status: "done", priority: "high", confidence: "high", createdAt: DEMO_CREATED, linkedNodeId: "landing" },
      { id: "fa2", force: 3, principle: "Every offer needs a promise worth repeating.", actionItem: "Add a 14-day guarantee to the upsell to remove the biggest objection at that step.", dollarValue: 250000, status: "in_progress", priority: "high", confidence: "medium", createdAt: DEMO_CREATED, linkedNodeId: "sale", linkedKpi: "revenue" },
      { id: "fa3", force: 5, principle: "Decide what happens to profit before it arrives.", actionItem: "Set a standing Freedom Fund transfer the day revenue clears, before any other spending decision.", dollarValue: 0, status: "open", priority: "medium", confidence: "high", createdAt: DEMO_CREATED, linkedKpi: "grossProfit" },
      { id: "fa4", force: 7, principle: "Turn delivered promises into referrals, on purpose.", actionItem: "Add a structured referral ask to the week-4 coaching call script.", dollarValue: 180000, status: "open", priority: "medium", confidence: "medium", createdAt: DEMO_CREATED, linkedKpi: "buyers" },
    ],
    visitedLessons: ["define", "story", "mindfulness", "money", "forces", "drivers", "raving", "brief"],
    introSeen: true,
    graduationSeen: true,
  },
  moneyMachine: { freedomFundRate: 0.15, securityRate: 0.5, growthRate: 0.3, dreamRate: 0.2 },
  objections: [
    { id: "obj1", objection: "I don't have time for another program.", response: "This replaces the hours you're already losing to being the bottleneck — it doesn't add to your week.", createdAt: DEMO_CREATED },
    { id: "obj2", objection: "I've tried coaching before and nothing changed.", response: "Most programs teach strategy. This one hands you the actual systems and holds weekly implementation calls until they're running.", createdAt: DEMO_CREATED },
  ],
  hooks: [
    { id: "hook1", hook: "You're not behind on growth. You're behind on systems.", angle: "reframe", createdAt: DEMO_CREATED },
    { id: "hook2", hook: "The business that can't survive your vacation isn't a business yet.", angle: "fear", createdAt: DEMO_CREATED },
  ],
  profitDrivers: { leadsPct: 0.1, salesProcessPct: 0.05, conversionPct: 0.08, transactionValuePct: 0.06, retentionPct: 0.1 },
  clientPromises: [
    { id: "cp1", promise: "Reply to any client message within one business day.", delivered: true, createdAt: DEMO_CREATED },
    { id: "cp2", promise: "A documented system handed off by week 8.", delivered: true, createdAt: DEMO_CREATED },
    { id: "cp3", promise: "A dedicated onboarding call within 48 hours of signup.", delivered: false, createdAt: DEMO_CREATED },
  ],
  ravingFans: { retentionRate: 0.72, referralRate: 0.31 },
  mindfulness: [
    { id: "mf1", kind: "assumption", text: "Assuming clients want more calls, when the last survey said they want fewer, shorter ones.", createdAt: DEMO_CREATED },
    { id: "mf2", kind: "opportunity", text: "Clients who complete week 4 refer at 3x the rate of everyone else — nobody is tracking who hits that mark.", createdAt: DEMO_CREATED },
  ],
  retargetingLoops: [],
  annotations: [],
};
