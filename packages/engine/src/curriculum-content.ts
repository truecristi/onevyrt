/**
 * The ONEVYRT Master Course Map — the 25 authored modules, as data.
 *
 * This is the single source of the taught content: each module's title,
 * teaching, the tool it sends the learner to (toolDeepLink — a real app route),
 * and its assignment. The programme is ASSEMBLED from CANONICAL_STAGES (the six
 * stages) + CANONICAL_LESSON_LAYOUT (which modules sit in each stage, in what
 * order) — both in curriculum-chapters.ts — so the order lives in exactly one
 * place and this file just fills in the content for each id in that layout.
 *
 * Design intent (the whole point of the restructure): every module points at a
 * tool ONEVYRT already has, in one locked order, so the scattered tools become a
 * single journey. Modules whose tool is a Business Intelligence tab (Goals, 7
 * Systems, Freedom Plan, Assumptions, Experiments) deep-link to /studio, where
 * those tabs live; the rest link straight to their own route.
 *
 * Pure data, no storage, no I/O.
 */
import type { ProgrammeTemplate, LessonTemplate, StageTemplate } from "./curriculum.ts";
import { CANONICAL_STAGES, CANONICAL_LESSON_LAYOUT } from "./curriculum-chapters.ts";

const NOW = "2026-01-01T00:00:00.000Z";

/** A module's authored content, minus the `order` (assigned at assembly time
 *  from CANONICAL_LESSON_LAYOUT so the order has a single source). */
type Module = Omit<LessonTemplate, "order">;

/**
 * Every module keyed by its stable id. The ids match CANONICAL_LESSON_LAYOUT;
 * OLD_TO_NEW_LESSON (curriculum-chapters.ts) maps the historical 22-lesson seed
 * onto these so existing progress carries across.
 */
const MODULES: Readonly<Record<string, Module>> = {
  // ── Start ──────────────────────────────────────────────────────────────────
  "m-start-assessment": {
    id: "m-start-assessment", title: "Personal & Business Assessment", estimatedMinutes: 25,
    outcome: "An honest before-picture — your business defined, your real starting numbers captured, and your starting Readiness Score — so every later change is measurable, not a feeling.",
    content:
      "Every plan that works starts from an honest ‘here’s where we actually are’ — not where you wish you were, not the best month you ever had. Before goals, offers or funnels, get the basics down: what the business is, who it serves, what it sells, and what the numbers actually say right now (revenue, profit, leads, conversion). Then check your Readiness Score — it will likely be low, and that’s the point: this is your ‘before’. You take the same score again at the Finish, so the transformation is measurable.",
    toolDeepLink: "/business", resourceUrls: [],
    assignment: {
      id: "a-start-assessment", title: "Capture your baseline and starting Readiness Score",
      instructions: "Open Business OS → Define and fill in your business name, who you serve, your main offer and your current reality. Then note your current Readiness Score and your real starting numbers.",
      evidencePrompt: "Your current monthly revenue, profit, lead count and conversion rate — plus your starting Readiness Score.",
      checklist: [
        { id: "c1", label: "Business name and who you serve entered" },
        { id: "c2", label: "Main offer described" },
        { id: "c3", label: "Current reality captured honestly, not aspirationally" },
        { id: "c4", label: "Starting Readiness Score noted" },
      ],
    },
  },

  // ── Chapter 1 — Define the Business and Psychology ──────────────────────────
  "m-founder-psychology": {
    id: "m-founder-psychology", title: "Founder Psychology", estimatedMinutes: 20,
    outcome: "A written vision with a real freedom number attached — what you actually want this business to give YOU, specific enough that you’ll know in 90 days whether you got it.",
    content:
      "The business you build is downstream of what you actually want from your life — name that first, or every later decision gets made on instinct. Put a stake in the ground: where is this business in 24–36 months, and what does ‘freedom’ mean in money terms (the number flowing to Security, Growth and Dream in your Freedom Plan)? Be specific, not aspirational — not ‘more freedom’, a number; not ‘grow the business’, what your own week looks like when it’s working. Everything else in the programme ladders up to this.",
    toolDeepLink: "/studio", resourceUrls: [],
    assignment: {
      id: "a-founder-psychology", title: "Write your vision and freedom number",
      instructions: "In Studio → Business Intelligence, open the Goal Hierarchy and add a Vision-level goal, then the Freedom Plan and set what ‘freedom’ means as a real number.",
      evidencePrompt: "Your vision statement, and your freedom target number.",
      checklist: [
        { id: "c1", label: "Wrote a Vision-level goal" },
        { id: "c2", label: "Attached a real freedom number" },
        { id: "c3", label: "It’s specific and measurable, not aspirational" },
      ],
    },
  },
  "m-business-definition": {
    id: "m-business-definition", title: "Business Definition", estimatedMinutes: 20,
    outcome: "A sharp, one-paragraph definition of the business — what it does, who exactly it’s for, and the one problem it solves — that everything downstream can be checked against.",
    content:
      "A fuzzy definition makes every later step fuzzy: the messaging, the offer, the funnel. Get it down to a single, specific paragraph — what the business does, the exact customer it’s for, and the one core problem it solves. ‘Marketing services for businesses’ is not a definition; ‘done-for-you lead funnels for coaches stuck under $10k/month’ is. If you can’t say it in a sentence, that’s the work.",
    toolDeepLink: "/business", resourceUrls: [],
    assignment: {
      id: "a-business-definition", title: "Write your one-paragraph business definition",
      instructions: "In Business OS → Define, tighten your business definition until a stranger could read it and know exactly what you do and who for.",
      evidencePrompt: "Your business, defined in one paragraph.",
      checklist: [
        { id: "c1", label: "What the business does is specific" },
        { id: "c2", label: "The exact customer is named" },
        { id: "c3", label: "The one core problem it solves is clear" },
      ],
    },
  },
  "m-customer-psychology": {
    id: "m-customer-psychology", title: "Customer Psychology", estimatedMinutes: 20,
    outcome: "The buyer in their own words — the problem they feel, what they secretly want, and the top 3 real objections — each with an evidence-backed response.",
    content:
      "You can’t persuade someone you haven’t understood. Get inside the buying decision: the problem they actually feel (not the one you wish they cared about), what they secretly want, and the objections that quietly kill the sale. Write the real things prospects have said — not hypothetical ones — and build a response to each with proof behind it, not just reassurance.",
    toolDeepLink: "/business/segments", resourceUrls: [],
    assignment: {
      id: "a-customer-psychology", title: "Map the buyer and answer their top 3 objections",
      instructions: "In Audiences, map who your ideal customer really is — the problem they feel and what they secretly want. Then, in Studio → Business Intelligence → Objections, log at least 3 real objections you’ve actually heard, each with an evidence-backed response.",
      evidencePrompt: "Your #1 objection and your best, proof-backed response to it.",
      checklist: [
        { id: "c1", label: "Logged 3+ real objections" },
        { id: "c2", label: "Wrote a response to each" },
        { id: "c3", label: "At least one response uses real proof, not reassurance" },
      ],
    },
  },
  "m-transformation-message": {
    id: "m-transformation-message", title: "Transformation & Message", estimatedMinutes: 20,
    outcome: "One clear message — problem → solution → result — and at least 3 hooks that make people stop, each tied to something you can prove.",
    content:
      "Everything you sell is a transformation: from where the customer is to where they want to be. Say it in one clear line — problem, your solution, the result — the sentence everything else grows from. Then write more than one hook, because you won’t know which angle lands until it’s in front of real people, and ground at least one in a specific proof point rather than a clever line.",
    toolDeepLink: "/business/message", resourceUrls: [],
    assignment: {
      id: "a-transformation-message", title: "Write your one-liner and 3 hooks",
      instructions: "In Business OS → Message, complete your one-liner (problem → solution → result). Then, in Business Intelligence → Hooks, add at least 3 hooks with one tied to a real proof point.",
      evidencePrompt: "Your one-liner, and your top 3 hooks.",
      checklist: [
        { id: "c1", label: "One-liner complete: problem, solution, result" },
        { id: "c2", label: "Wrote 3+ hooks" },
        { id: "c3", label: "At least one hook ties to a specific proof point" },
      ],
    },
  },
  "m-strategic-direction": {
    id: "m-strategic-direction", title: "Strategic Direction", estimatedMinutes: 30,
    outcome: "A full, honest Seven Forces diagnosis and your top 3 highest-leverage fixes — each with an owner, a deadline and a dollar value — so you know where the next 90 days go.",
    content:
      "Every business breaks in one of seven places — rarely the one the owner is staring at. Run the Seven Forces diagnosis across all of them (business map, strategy, marketing promises, sales, finance/legal, execution, client advocacy), not just the loudest fire. Then turn a long list into a plan: rank by dollar value and confidence, and commit your top 3 — the highest-value fixes you’re confident you can actually pull off — as this quarter’s direction.",
    toolDeepLink: "/studio", resourceUrls: [],
    assignment: {
      id: "a-strategic-direction", title: "Diagnose the Seven Forces and prioritise your top 3 fixes",
      instructions: "In Studio → Business Intelligence → 7 Systems, add real action items across all seven, put a dollar value on at least one, then set an owner, deadline and confidence on your top 3.",
      evidencePrompt: "Your single biggest constraint, and your top 3 prioritised fixes in order.",
      checklist: [
        { id: "c1", label: "Reviewed all 7 Systems honestly" },
        { id: "c2", label: "Put a dollar value on at least one action" },
        { id: "c3", label: "Top 3 fixes have owner + deadline + confidence" },
      ],
    },
  },

  // ── Chapter 2 — Implement It in the Business ─────────────────────────────────
  "m-positioning-brand": {
    id: "m-positioning-brand", title: "Positioning & Brand", estimatedMinutes: 20,
    outcome: "A one-line positioning statement (who it’s for, why you over the alternative) and a consistent brand voice — so every word you ship lands harder.",
    content:
      "Positioning is the choice of who you’re for and why you beat the alternative in their eyes — make it explicit or the market makes it for you, badly. Nail the statement, then set a brand voice you can apply consistently across the funnel, the ads and the follow-up. Consistency is what turns scattered touches into something recognisable.",
    toolDeepLink: "/psychology/offer", resourceUrls: [],
    assignment: {
      id: "a-positioning-brand", title: "Write your positioning and set your brand voice",
      instructions: "In Psychology → Offer, write your positioning line (for whom, why you). Then set your brand voice in Campaign Studio → Brand.",
      evidencePrompt: "Your positioning statement, in one line.",
      checklist: [
        { id: "c1", label: "Positioning names the exact who" },
        { id: "c2", label: "Positioning says why you over the alternative" },
        { id: "c3", label: "Brand voice set for reuse across the funnel" },
      ],
    },
  },
  "m-offer": {
    id: "m-offer", title: "Offer", estimatedMinutes: 20,
    outcome: "A specific, named offer — one problem, one clear promise, one price, a stacked value and a guarantee — instead of ‘everything for everyone’.",
    content:
      "The tighter the offer, the easier everything downstream gets. Get specific: the exact problem it solves, the promise, the price, and the guarantee that removes the risk of saying yes. ‘Marketing services’ isn’t an offer; ‘a 90-day funnel rebuild for coaches stuck under $10k/month, or you don’t pay’ is.",
    toolDeepLink: "/psychology/offer", resourceUrls: [],
    assignment: {
      id: "a-offer", title: "Build your offer",
      instructions: "In Psychology → Offer, name the offer, promise a result, stack the value, frame the price, and add a guarantee.",
      evidencePrompt: "Your offer, in one sentence, and its price.",
      checklist: [
        { id: "c1", label: "Offer is specific, not generic" },
        { id: "c2", label: "Price framed and a guarantee added" },
        { id: "c3", label: "Value stack makes the price feel small" },
      ],
    },
  },
  "m-customer-journey": {
    id: "m-customer-journey", title: "Customer Journey", estimatedMinutes: 25,
    outcome: "The real path a customer takes — landing, capture/booking, checkout, thank-you — mapped on the canvas, with tracking live so plan numbers become real.",
    content:
      "A funnel isn’t a landing page, it’s the whole path: how someone finds you, what they see first, what they’re asked to do, and what happens after they say yes. Build the canvas to reflect the REAL path today, not the aspirational one — including the lead-capture step and the thank-you page. Then get tracking live: everything in PLAN mode is a projection until real visits confirm it.",
    toolDeepLink: "/business/funnels", resourceUrls: [],
    assignment: {
      id: "a-customer-journey", title: "Map your funnel and get tracking live",
      instructions: "In the Lead Funnel Builder, lay out landing → capture/booking → checkout → thank-you in order. Then copy your tracking snippet onto at least one real page.",
      evidencePrompt: "Your funnel steps in order, and whether tracking has recorded a real visit yet.",
      checklist: [
        { id: "c1", label: "Landing + capture/booking steps present" },
        { id: "c2", label: "Checkout + thank-you steps present" },
        { id: "c3", label: "Tracking snippet live on a real page" },
      ],
    },
  },
  "m-marketing-system": {
    id: "m-marketing-system", title: "Marketing System", estimatedMinutes: 25,
    outcome: "Your real traffic channels represented with honest economics — spend and cost-per-visitor per channel — so you can see which one actually works.",
    content:
      "A marketing system is how strangers reliably become visitors. Campaign setup happens on each platform itself (Meta, Google, organic) — ONEVYRT doesn’t run your ads — but what it’s built for is holding the resulting economics honestly, channel by channel, so the guessing stops. Add a traffic block per live channel with the real spend and visitor numbers, and it feeds the same simulation as everything else.",
    toolDeepLink: "/campaign-studio/brand", resourceUrls: [],
    assignment: {
      id: "a-marketing-system", title: "Represent your real channels with real numbers",
      instructions: "Use Campaign Studio to shape the creative and message, then add a traffic block per live channel (Facebook/Instagram, Google, organic) with real spend and visitor numbers.",
      evidencePrompt: "Your top traffic channel and its cost-per-visitor.",
      checklist: [
        { id: "c1", label: "At least one channel represented with real numbers" },
        { id: "c2", label: "Spend and visitors are real, not placeholders" },
        { id: "c3", label: "Creative/message set in Campaign Studio" },
      ],
    },
  },
  "m-sales-system": {
    id: "m-sales-system", title: "Sales System", estimatedMinutes: 20,
    outcome: "A written qualify → follow-up → close process, plus one real lost-lead recovery action — so leads convert instead of dying in silence.",
    content:
      "Most leads are lost to silence, not rejection. Write exactly what happens after someone becomes a lead: how they’re qualified, what the follow-up sequence says and when, and your booking-to-close steps. Be honest about what’s built versus planned — this app tracks the plan and the numbers, it doesn’t send the messages. Then write one concrete action for winning back a lead who’s gone quiet.",
    toolDeepLink: "/business/leads", resourceUrls: [],
    assignment: {
      id: "a-sales-system", title: "Write your qualify-to-close process and one recovery action",
      instructions: "In the Leads Inbox, define your qualification criteria and follow-up cadence, your booking-to-close steps, and one lost-lead recovery action you’ll actually use.",
      evidencePrompt: "Your follow-up sequence, your close-rate estimate, and one recovery action.",
      checklist: [
        { id: "c1", label: "Qualification criteria written" },
        { id: "c2", label: "Follow-up cadence + close steps written" },
        { id: "c3", label: "One lost-lead recovery action written" },
      ],
    },
  },
  "m-delivery-operations": {
    id: "m-delivery-operations", title: "Delivery & Operations", estimatedMinutes: 20,
    outcome: "Your client promises logged with an honest read on whether they’re kept, and real retention/referral rates — a Client Advocacy score you can trust.",
    content:
      "Retention and referrals both come from the same place: keeping the promises you actually made, consistently. Before chasing more reviews, get honest about whether today’s promises are being delivered. Log the real promises, mark delivery honestly, and enter your real retention and referral rates so the score reflects reality instead of staying blank.",
    toolDeepLink: "/business/execution", resourceUrls: [],
    assignment: {
      id: "a-delivery-operations", title: "Log your promises and set retention/referral rates",
      instructions: "In Execution, log at least 2 real client promises with honest delivery status, then set your retention and referral rates to build your Client Advocacy score (Client Advocacy lives in Business Intelligence).",
      evidencePrompt: "Your promise-delivery rate, and your Client Advocacy score.",
      checklist: [
        { id: "c1", label: "Logged 2+ client promises with delivery status" },
        { id: "c2", label: "Set retention rate" },
        { id: "c3", label: "Set referral rate" },
      ],
    },
  },
  "m-90-day-plan": {
    id: "m-90-day-plan", title: "90-Day Implementation Plan", estimatedMinutes: 20,
    outcome: "The whole system turned into a dated, ordered 90-day plan — what gets done, in what order, by when — so implementation actually happens.",
    content:
      "A system that only exists as knowledge changes nothing — it has to become a schedule. Pull the fixes and build-outs from this chapter into one ordered 90-day plan with real dates and owners, so ‘what do I do this week’ has an answer every week. This is the plan that carries you from a defined business to a running one.",
    toolDeepLink: "/start", resourceUrls: [],
    assignment: {
      id: "a-90-day-plan", title: "Build your 90-day implementation plan",
      instructions: "In Your Plan, lay out the ordered steps for the next 90 days with dates — pulling in the priorities from Strategic Direction and the build-outs from this chapter.",
      evidencePrompt: "Your top 3 actions for the next 2 weeks, with dates.",
      checklist: [
        { id: "c1", label: "Steps are ordered and dated" },
        { id: "c2", label: "This week’s actions are concrete" },
        { id: "c3", label: "The plan reaches your Chapter-1 priorities" },
      ],
    },
  },

  // ── Chapter 3 — Define and Control the Numbers ──────────────────────────────
  "m-personal-freedom-number": {
    id: "m-personal-freedom-number", title: "Personal Freedom Number", estimatedMinutes: 15,
    outcome: "Real Security, Growth and Dream targets set in the Freedom Plan — numbers to build toward, so profit has a job the day it exists.",
    content:
      "Knowing your margin isn’t enough — decide in advance what happens to the profit once it exists. That’s the whole point of the Freedom Fund split. Set a real target for each bucket: what does ‘Security is done’ actually look like in your account, then Growth, then Dream? This is the personal number the whole numbers chapter serves.",
    toolDeepLink: "/studio", resourceUrls: [],
    assignment: {
      id: "a-personal-freedom-number", title: "Set your three freedom targets",
      instructions: "In Business Intelligence → Freedom Plan → The Fund, set a Security, Growth and Dream target based on your real margin.",
      evidencePrompt: "Your Security, Growth and Dream targets, in numbers.",
      checklist: [
        { id: "c1", label: "Security target set" },
        { id: "c2", label: "Growth target set" },
        { id: "c3", label: "Dream target set" },
      ],
    },
  },
  "m-price-unit-economics": {
    id: "m-price-unit-economics", title: "Price & Unit Economics", estimatedMinutes: 20,
    outcome: "One sale’s real economics — price minus true cost, the margin, and how many you must sell to break even — so you know it pays before you spend.",
    content:
      "Everything scales on the economics of a single sale. Work out the true cost to deliver one, the margin left, and the break-even: how many you must sell to cover what you spend to get them. If the unit doesn’t work, spending more only loses money faster — fix the unit first.",
    toolDeepLink: "/numbers/break-even", resourceUrls: [],
    assignment: {
      id: "a-price-unit-economics", title: "Work out your unit economics and break-even",
      instructions: "In Numbers → Break-even, enter your price and true per-sale cost, read your margin, and note how many sales break you even.",
      evidencePrompt: "Your price, per-sale margin, and break-even quantity.",
      checklist: [
        { id: "c1", label: "Price and true per-sale cost entered" },
        { id: "c2", label: "Margin read honestly" },
        { id: "c3", label: "Break-even quantity noted" },
      ],
    },
  },
  "m-growth-mathematics": {
    id: "m-growth-mathematics", title: "Growth Mathematics", estimatedMinutes: 20,
    outcome: "The two or three levers that actually move your revenue — traffic, conversion, price, retention — identified and ranked, so effort goes where the maths pays.",
    content:
      "Revenue is a chain of multipliers: traffic × conversion × price × repeat. Small moves on the right link swamp big moves on the wrong one. Use the profit drivers to see which lever, moved a realistic amount, changes the outcome most — then aim your next 30 days at that link instead of the one that feels busiest.",
    toolDeepLink: "/numbers", resourceUrls: [],
    assignment: {
      id: "a-growth-mathematics", title: "Find your highest-leverage growth lever",
      instructions: "In Numbers, use the profit drivers / sensitivity view to rank your levers, and identify the one that moves revenue most for a realistic change.",
      evidencePrompt: "Your #1 growth lever, and what a realistic move on it does to revenue.",
      checklist: [
        { id: "c1", label: "Levers ranked by impact" },
        { id: "c2", label: "Top lever identified" },
        { id: "c3", label: "Next 30 days aimed at it" },
      ],
    },
  },
  "m-business-economics": {
    id: "m-business-economics", title: "Business Economics", estimatedMinutes: 20,
    outcome: "The whole-business money model — revenue in, costs out, profit and where it goes — on one page you can read and trust.",
    content:
      "Zoom out from one sale to the whole machine: total revenue, fixed and variable costs, and the profit that actually reaches you. This is the model that tells you whether the business — not just the funnel — is healthy, and it’s what feeds your Freedom Plan targets. Read it honestly; a business that looks busy can still be quietly unprofitable.",
    toolDeepLink: "/numbers", resourceUrls: [],
    assignment: {
      id: "a-business-economics", title: "Build your whole-business money model",
      instructions: "In Numbers, review the business report / money-machine view: revenue, costs and profit for the whole business, and check it against your freedom targets.",
      evidencePrompt: "Your monthly profit, and whether it’s on track to your freedom number.",
      checklist: [
        { id: "c1", label: "Revenue and costs captured" },
        { id: "c2", label: "Real profit read honestly" },
        { id: "c3", label: "Checked against your freedom number" },
      ],
    },
  },
  "m-plan-vs-actual": {
    id: "m-plan-vs-actual", title: "Plan versus Actual", estimatedMinutes: 20,
    outcome: "Your projection compared against real numbers — the variance named — so you’re steering by what’s happening, not what you hoped.",
    content:
      "A plan is a hypothesis; reality is the test. Put your projected numbers next to the actuals and read the gap: where you’re ahead, where you’re behind, and by how much. The variance is the signal — it tells you which assumption to revisit next, and it’s the difference between running the business and hoping.",
    toolDeepLink: "/business/review", resourceUrls: [],
    assignment: {
      id: "a-plan-vs-actual", title: "Compare plan against actual and name the biggest gap",
      instructions: "In Business OS → Review, put your plan next to your actuals and identify the single biggest variance.",
      evidencePrompt: "Your biggest plan-vs-actual gap, and what it tells you to change.",
      checklist: [
        { id: "c1", label: "Plan and actuals compared" },
        { id: "c2", label: "Biggest variance identified" },
        { id: "c3", label: "Named the change it points to" },
      ],
    },
  },
  "m-improvement-loop": {
    id: "m-improvement-loop", title: "Improvement Loop", estimatedMinutes: 20,
    outcome: "A live habit: your riskiest assumptions named, one experiment run to a real result, and a real decision made — adopt, reject or iterate.",
    content:
      "Every plan rests on beliefs nobody’s tested — ‘this channel will keep converting’, ‘people will pay this price’. Left unspoken they become facts nobody questioned. Name your riskiest assumptions with an honest confidence level, pick the riskiest, design a small test, and — the part most people skip — come back and record what actually happened and what you’re doing about it. That loop is how the business keeps improving after the programme ends.",
    toolDeepLink: "/studio", resourceUrls: [],
    assignment: {
      id: "a-improvement-loop", title: "Name assumptions, run one experiment, record the result",
      instructions: "In Business Intelligence → Assumptions, log 3 real assumptions with confidence levels. In Experiments, run one linked to your riskiest, then record its result and decision.",
      evidencePrompt: "Your experiment’s result, and your decision (adopt / reject / iterate).",
      checklist: [
        { id: "c1", label: "Logged 3+ assumptions with confidence" },
        { id: "c2", label: "Ran one experiment linked to an assumption" },
        { id: "c3", label: "Recorded a result and a decision" },
      ],
    },
  },

  // ── Chapter 4 — Improve and Scale the Business ───────────────────────────────
  "m-bottleneck": {
    id: "m-bottleneck", title: "Find the Bottleneck", estimatedMinutes: 20,
    outcome: "One evidence-backed answer to ‘what’s the single biggest thing limiting growth right now’ — every area scored, a constraint declared, the one move that relieves it, and what you’ll stop doing so it gets the focus.",
    content:
      "A business only grows as fast as its tightest constraint — fix anything else first and you’re busy, not faster. Score every area honestly (traffic, conversion, sales, offer, delivery, retention, profit, cash, team, systems), not just the one making the most noise today. The evidence, not the feeling, should point at the constraint. Then commit: name the single move that relieves it, and — just as important — what you’ll deliberately stop doing elsewhere so the constraint actually gets your attention instead of competing with five other priorities.",
    toolDeepLink: "/business/constraint", resourceUrls: [],
    assignment: {
      id: "a-bottleneck", title: "Score, declare and commit to your one constraint",
      instructions: "In Business OS → Constraint, score every area of the business by how much it holds growth back right now, with real evidence behind the top score. Declare the constraint, the one move to relieve it, and what you’ll stop doing so it gets the focus.",
      evidencePrompt: "Your declared constraint, the evidence behind it, and the one move you’re committing to.",
      checklist: [
        { id: "c1", label: "Scored every area with real evidence, not a guess" },
        { id: "c2", label: "Declared the single constraint the evidence points to" },
        { id: "c3", label: "Named the one move that relieves it" },
        { id: "c4", label: "Named what you’ll stop doing so it gets the focus" },
      ],
    },
  },
  "m-improve-conversion": {
    id: "m-improve-conversion", title: "Improve Conversion", estimatedMinutes: 20,
    outcome: "The weakest step in leads → appointments → sales identified with real numbers, one concrete change made to it, and a before/target number to know if it worked.",
    content:
      "Conversion isn’t one number, it’s a chain: lead → appointment → sale. Guessing which link is weak wastes the fix; the real numbers from your Sales System and your Numbers chapter already show it. Find the single weakest step, make ONE concrete change to it — not five vague ones — and write down the number before the change and the number you expect after. Small honest tests beat big unmeasured overhauls.",
    toolDeepLink: "/business/leads", resourceUrls: [],
    assignment: {
      id: "a-improve-conversion", title: "Fix the weakest step in your conversion chain",
      instructions: "In the Leads Inbox, use your real numbers to find the weakest step from lead to appointment to sale. Make one concrete change to your qualification, follow-up or close process there, and note the before number and your target.",
      evidencePrompt: "The weakest step you found, the one change you made, and your before → target numbers.",
      checklist: [
        { id: "c1", label: "Weakest step identified from real numbers, not a guess" },
        { id: "c2", label: "One concrete change made to that step" },
        { id: "c3", label: "Before number recorded" },
        { id: "c4", label: "Target number set" },
      ],
    },
  },
  "m-improve-profit": {
    id: "m-improve-profit", title: "Improve Profit", estimatedMinutes: 20,
    outcome: "One profit lever — price, margin or cost — pulled with a real, calculated dollar impact, checked against your freedom number.",
    content:
      "Profit is price minus true cost, times volume — three levers, not one. A small lift on the right lever (often price, almost always under-used) beats a big push on the wrong one. Using your unit economics and business economics from Chapter 3, pick the ONE lever with the biggest realistic dollar impact — a price increase, a cost you can cut without cutting quality, or a higher-value add-on — make the change, and calculate the new margin so it’s a number, not a hope.",
    toolDeepLink: "/numbers", resourceUrls: [],
    assignment: {
      id: "a-improve-profit", title: "Pull one profit lever and calculate its impact",
      instructions: "In Numbers, using your unit and business economics, choose the one profit lever — price, cost or value-add — with the biggest realistic impact. Make the change and calculate the new margin.",
      evidencePrompt: "The lever you chose, the change you made, and the calculated before → after margin or profit.",
      checklist: [
        { id: "c1", label: "Chose the lever with the biggest realistic dollar impact" },
        { id: "c2", label: "Made the actual change (price, cost or value)" },
        { id: "c3", label: "Calculated the new margin/profit, not estimated it" },
        { id: "c4", label: "Checked it against your freedom number" },
      ],
    },
  },
  "m-systemise-automate": {
    id: "m-systemise-automate", title: "Systemise & Automate", estimatedMinutes: 20,
    outcome: "One piece of work that currently only happens because the founder personally does it, turned into a written process, an automation, or a real handoff — with someone or something else now able to run it.",
    content:
      "Whatever only runs because you personally do it every time is the ceiling on how big this gets. Pick one repetitive task and move it off you — in order of cost: write it down as a process anyone could follow, get a tool to do it automatically, or hand it to someone else. Half-done doesn’t count: the task needs an actual owner other than you by the end of this module, even if that owner is a checklist and a calendar reminder to start.",
    toolDeepLink: "/business/execution", resourceUrls: [],
    assignment: {
      id: "a-systemise-automate", title: "Move one task off yourself",
      instructions: "In Execution, name one repetitive task you currently do personally. Decide whether to turn it into a written process, an automation, or a delegated handoff — then actually build the first version and name who or what owns it now.",
      evidencePrompt: "The task, which route you took (process / automate / delegate), and who or what owns it now.",
      checklist: [
        { id: "c1", label: "Named one repetitive founder-only task" },
        { id: "c2", label: "Chose process, automate or delegate" },
        { id: "c3", label: "Built the first real version (not just planned it)" },
        { id: "c4", label: "Named the new owner — a person, a tool, or a documented process" },
      ],
    },
  },
  "m-growth-plan": {
    id: "m-growth-plan", title: "Build the Growth Plan", estimatedMinutes: 25,
    outcome: "Your constraint, conversion fix, profit lever and systemised task from this chapter turned into one dated, owned 90-day Growth & Improvement Plan — the chapter’s output, ready for your coach to review.",
    content:
      "Four real moves mean nothing scattered across four separate modules — they need to become one plan. Pull the constraint you declared, the conversion fix, the profit lever and the systemised task together into a single 90-day roadmap: what happens, in what order, who owns it, and what number proves it worked. This is the Growth & Improvement Plan — the permanent artifact this chapter produces, and what your Transformation Report at Finish carries forward as your next 90 days.",
    toolDeepLink: "/start", resourceUrls: [],
    assignment: {
      id: "a-growth-plan", title: "Build and submit your 90-day Growth & Improvement Plan",
      instructions: "In Your Plan, bring together your constraint (4.1), conversion fix (4.2), profit lever (4.3) and systemised task (4.4) into one ordered, dated 90-day plan with an owner and a target number for each. Once every subchapter is done, submit the plan from the Programme journey for your coach to review.",
      evidencePrompt: "Your 90-day Growth & Improvement Plan — the constraint, conversion, profit and systems actions, each dated with an owner and a target number.",
      checklist: [
        { id: "c1", label: "Constraint-relief action dated and owned" },
        { id: "c2", label: "Conversion fix dated and owned" },
        { id: "c3", label: "Profit lever dated and owned" },
        { id: "c4", label: "Systemise/automate action dated and owned" },
        { id: "c5", label: "Each action has a target number to prove it worked" },
      ],
    },
  },

  // ── Finish ──────────────────────────────────────────────────────────────────
  "m-finish-transformation": {
    id: "m-finish-transformation", title: "Transformation Report & Next 90 Days", estimatedMinutes: 20,
    outcome: "Your Readiness Score re-checked against your Start baseline — the whole programme’s result in one number — plus your Chapter 4 Growth & Improvement Plan carried forward as your real next 90 days.",
    content:
      "This closes the loop that opened at the Start. Check your Readiness Score again and compare it honestly to where you began — that gap is your transformation. Your next 90 days are already written: it’s the Growth & Improvement Plan you built and got approved in Chapter 4 — the constraint you found, the conversion and profit levers you pulled, and the task you systemised. Bring it forward here so the Transformation Report shows not just how far you’ve come, but exactly what happens next.",
    toolDeepLink: "/numbers", resourceUrls: [],
    assignment: {
      id: "a-finish-transformation", title: "Compare your score and carry your Growth & Improvement Plan forward",
      instructions: "Re-check your Readiness Score and compare it to your Start baseline. Then bring your approved Chapter 4 Growth & Improvement Plan forward as your next 90 days — it's already dated, owned and ready.",
      evidencePrompt: "Your final Readiness Score vs. your starting score, and your next 90 days from the Growth & Improvement Plan.",
      checklist: [
        { id: "c1", label: "Final Readiness Score compared to the Start baseline" },
        { id: "c2", label: "Chapter 4 Growth & Improvement Plan carried forward as the next 90 days" },
        { id: "c3", label: "Transformation Report reflects both the before/after and what's next" },
      ],
    },
  },
};

/**
 * Assemble the canonical programme: for each stage (in CANONICAL_STAGES), pull
 * its module ids from CANONICAL_LESSON_LAYOUT, look up each module's content, and
 * assign its order. Throws if the layout references an unknown module id — a
 * loud, build-time guard that the layout and the content never drift apart.
 */
export function buildCanonicalProgramme(): ProgrammeTemplate {
  const layoutByStage = new Map(CANONICAL_LESSON_LAYOUT.map((g) => [g.stageId, g.lessonIds] as const));
  const stages: StageTemplate[] = CANONICAL_STAGES.map((meta) => {
    const ids = layoutByStage.get(meta.id) ?? [];
    const lessons: LessonTemplate[] = ids.map((id, i) => {
      const mod = MODULES[id];
      if (!mod) throw new Error(`curriculum-content: no module authored for layout id "${id}"`);
      return { ...mod, order: i + 1 };
    });
    return { id: meta.id, order: meta.order, title: meta.title, outcome: meta.outcome, lessons };
  });
  // schemaVersion is intentionally left off here — the seed and the v3 migration
  // both wrap this in reconcileToChapters(), which stamps the canonical version.
  return {
    id: "onevyrt-growth-programme",
    name: "ONEVYRT Growth Programme",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    stages,
  };
}

/** The canonical ONEVYRT programme (the 25-module Master Course Map), assembled
 *  from the layout + authored content. The app seed and the v3 migration both
 *  use THIS so there is one definition of the course. */
export const CANONICAL_PROGRAMME: ProgrammeTemplate = buildCanonicalProgramme();
