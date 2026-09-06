/**
 * The manual — the expanded, in-app teaching for each of the 20 modules.
 *
 * WHY THIS LIVES IN THE WEB APP (not the engine's curriculum-content.ts):
 * the engine owns the CANONICAL programme — structure, order, the base outcome,
 * and the assignment. Those are learner-joined data: they're seeded into the DB
 * by a versioned migration and every enrollment/submission joins on the lesson
 * id. This file is the opposite kind of thing — PRESENTATION copy that we expect
 * to keep refining. Keeping it here means the teaching is edit-and-deploy with
 * NO database migration: change a paragraph, rebuild, deploy, done. The guided
 * lesson page merges it in at read time by module id; a module with no entry
 * here simply falls back to the engine's base `content` paragraph, so nothing
 * breaks if one is missing.
 *
 * The shape mirrors the manual model exactly: What this is → Why it matters →
 * (your why, on the first module) → How to do it → an Example. The assignment
 * and the tool button are still driven by the engine, underneath this.
 *
 * Pure data, no I/O.
 */

export interface ModuleTeaching {
  /** The framework, in a few honest sentences — the idea, not filler. */
  whatThisIs: string;
  /** What breaks if you skip it — the reason this beat exists in the arc. */
  why: string;
  /** Two to four concrete steps. Imperative, specific, doable today. */
  how: string[];
  /** A worked example whose SHAPE the learner can copy. Concrete, not abstract. */
  example?: string;
  /** Only on Founder Psychology: prompts the learner's personal "why" — the one
   *  line they come back to on the hard days. Rendered as a highlighted prompt. */
  mantraPrompt?: string;
}

/**
 * Keyed by the canonical module id (see curriculum-chapters.ts CANONICAL_LESSON_LAYOUT).
 * Order here is just for humans — the journey order is the engine's.
 */
export const MANUAL_TEACHING: Readonly<Record<string, ModuleTeaching>> = {
  // ── Start ──────────────────────────────────────────────────────────────────
  "m-start-assessment": {
    whatThisIs:
      "Before goals, offers or funnels, you write down an honest ‘here’s where we actually are’ — the business defined in a line, the real numbers as they stand today, and a first Readiness Score. Not the best month you ever had. Today.",
    why:
      "You can’t measure a transformation you never took a ‘before’ picture of. This is that picture. The score will likely be low — that’s not failure, it’s the whole point: it’s the baseline every later change gets measured against, so progress becomes a number instead of a feeling.",
    how: [
      "Open the Studio’s Business Intelligence → Define tab and write what the business is, who it serves and what it sells.",
      "Enter your real current numbers: monthly revenue, profit, lead count, conversion rate.",
      "Note your starting Readiness Score (the Readiness tab) exactly as it comes out — don’t round it up.",
    ],
    example:
      "‘Freelance brand designer, works with early-stage founders, sells logo + identity packages. ~$4,200/mo revenue, ~$3,000 profit, ~6 leads/mo, closes 2. Readiness: 21.’ — honest, plain, and now measurable.",
  },

  // ── Chapter 1 — Define the Business and Psychology ──────────────────────────
  "m-founder-psychology": {
    whatThisIs:
      "The business you build is downstream of what you actually want from your life. Before strategy, you name the destination — where this business is in 24–36 months, and what ‘freedom’ means to you as a real number, not a mood.",
    why:
      "Every later decision — which offer, which channel, which client to turn down — gets made against this. Founders rarely burn out from hard work; they burn out from hard work aimed at someone else’s definition of success. Name yours and the rest of the programme has something to ladder up to.",
    how: [
      "Write where the business is in 24–36 months — specific, not ‘bigger’.",
      "Put a real number on ‘freedom’: what flows to Security, Growth and Dream in your Freedom Plan.",
      "Write your one-line why — your own, not the market’s — and keep it where you’ll see it.",
    ],
    example:
      "Vision: ‘A studio of three that runs a week without me.’ Freedom number: ‘$12k/mo to me, $3k of it passive.’ Why: ‘So my kids never watch me ask a boss for permission.’",
    mantraPrompt:
      "One line you’ll come back to on the hard days — the real reason you’re doing this at all.",
  },
  "m-business-definition": {
    whatThisIs:
      "A single, specific paragraph: what the business does, the exact customer it’s for, and the one core problem it solves. Sharp enough that a stranger could read it and know precisely what you do and who for.",
    why:
      "A fuzzy definition makes everything downstream fuzzy — the message, the offer, the funnel all inherit the blur. If you can’t say it in a sentence, that vagueness is exactly the work you’re here to do. Tightening it is the cheapest leverage in the whole programme.",
    how: [
      "Name what the business actually does — the concrete service or product, not a category.",
      "Name the exact customer — narrow enough to picture one real person.",
      "Name the one core problem you remove for them, and cut everything else.",
    ],
    example:
      "Not ‘marketing services for businesses’. Instead: ‘Done-for-you lead funnels for coaches stuck under $10k/month who are great in the room but invisible online.’",
  },
  "m-customer-psychology": {
    whatThisIs:
      "The buying decision from the inside: the problem your customer actually feels, what they secretly want, and the top three objections that quietly kill the sale — each answered with proof, not reassurance.",
    why:
      "You can’t persuade someone you haven’t understood. Most offers fail not on price but on an unspoken objection nobody answered. Write the real things prospects have said — not the ones you wish they cared about — and you’ll out-sell better-funded competitors who are still guessing.",
    how: [
      "In Audiences, write the problem they feel in their words and what they secretly want.",
      "In Business Intelligence → Objections, log at least 3 real objections you’ve actually heard.",
      "Answer each with evidence — a result, a case, a guarantee — not just ‘don’t worry’.",
    ],
    example:
      "Objection: ‘I’ve been burned by an agency before.’ Weak answer: ‘We’re different.’ Strong answer: ‘Here’s the 14-day opt-out and three clients who left their last agency for us — talk to them.’",
  },
  "m-transformation-message": {
    whatThisIs:
      "One clear message — problem → your solution → the result — the sentence everything else grows from. Then more than one hook, because you won’t know which angle lands until it’s in front of real people.",
    why:
      "Everything you sell is a transformation: from where the customer is to where they want to be. If you can’t state that move in a line, your ads, page and pitch will all wander. And a single hook is a bet; a handful is a test — one of them ties to proof and pulls ahead.",
    how: [
      "Write the one-liner: the problem, your solution, the result — in that order.",
      "In Business Intelligence → Hooks, write at least 3 different angles on it.",
      "Ground at least one hook in a specific proof point, not a clever turn of phrase.",
    ],
    example:
      "One-liner: ‘Coaches who are booked out but broke get a funnel that fills calendars while they coach.’ Proof hook: ‘The exact funnel that took Dana from 6 to 22 calls a month.’",
  },
  "m-strategic-direction": {
    whatThisIs:
      "A Seven Forces diagnosis across the whole business — map, strategy, marketing, sales, finance, execution, client advocacy — and then your top three highest-leverage fixes, each with an owner, a deadline and a dollar value.",
    why:
      "Every business breaks in one of seven places, and it’s rarely the one the owner is staring at. Fixing the loudest fire instead of the most valuable one is how founders stay busy and stuck. Rank by dollars and confidence, commit to three, and the next 90 days have a spine.",
    how: [
      "In Studio → 7 Systems, add real, honest action items across all seven — including the ones you’ve been avoiding.",
      "Put a dollar value on at least one, so the list stops being equal-weight.",
      "Pick your top 3 by value × confidence and set an owner, deadline and confidence on each.",
    ],
    example:
      "Diagnosis surfaces that ‘Sales follow-up’ leaks ~$4k/mo — more than the traffic problem you were obsessing over. Top fix: ‘Build a 5-touch follow-up. Owner: me. Due: 14 days. Confidence: high.’",
  },

  // ── Chapter 2 — Implement It in the Business ─────────────────────────────────
  "m-positioning-brand": {
    whatThisIs:
      "A one-line positioning statement — who you’re for and why you beat the alternative in their eyes — plus a brand voice you can apply consistently across the funnel, the ads and the follow-up.",
    why:
      "Positioning is the choice of who you’re for; make it explicit or the market makes it for you, badly. And consistency is what turns scattered touches into something recognisable — the same voice across every surface compounds, a different voice each time resets to zero.",
    how: [
      "In Psychology → Offer, write the positioning line: for whom, and why you over the alternative.",
      "Set a brand voice in Campaign Studio → Brand you can actually reuse.",
      "Check it against the alternative the customer would otherwise pick — you must beat it, not match it.",
    ],
    example:
      "‘For coaches who hate ‘salesy’ funnels — the calm, no-hype system that still books calls.’ Voice: plain, warm, evidence-led. Never uses ‘crush it’.",
  },
  "m-offer": {
    whatThisIs:
      "A specific, named offer: one problem, one clear promise, one price, a stacked value and a guarantee that removes the risk of saying yes. Not ‘everything for everyone’ — one sharp thing.",
    why:
      "The tighter the offer, the easier everything downstream gets — the ad, the page, the sales call all get simpler. A vague offer forces the customer to do the work of figuring out what they’re buying, and most won’t. Specificity is what makes the price feel small.",
    how: [
      "In Psychology → Offer, name it and state the single result it promises.",
      "Stack the value so the price reads as obviously worth it, then frame the price.",
      "Add a guarantee that takes the risk off the buyer and puts it on you.",
    ],
    example:
      "‘The 90-Day Calendar Fill: a done-for-you booking funnel + 5-touch follow-up. $4,000. If you don’t get 20+ booked calls in 90 days, you don’t pay the final $2,000.’",
  },
  "m-customer-journey": {
    whatThisIs:
      "The real path a customer takes — how they find you, what they see first, what they’re asked to do, and what happens after they say yes — laid out on the canvas as it is today, with tracking live.",
    why:
      "A funnel isn’t a landing page, it’s the whole path, and the leaks are usually between the steps, not on them. Mapping the aspirational funnel teaches you nothing; mapping the real one shows you where people actually fall out. And until tracking is live, every number is a guess.",
    how: [
      "In the Lead Funnel Builder, lay out landing → capture/booking → checkout → thank-you in real order.",
      "Include the steps you skip in your head — the capture step and the thank-you page especially.",
      "Copy the tracking snippet onto at least one real page and confirm a live visit records.",
    ],
    example:
      "Mapping it reveals there’s no thank-you step, so 40% of bookings never get a reminder — and the ‘low close rate’ was really a no-show problem all along.",
  },
  "m-marketing-system": {
    whatThisIs:
      "Your real traffic channels, each represented with honest economics — spend and cost-per-visitor — so you can see which one actually works. The campaigns run on the platforms; ONEVYRT holds the truth about what they cost.",
    why:
      "A marketing system is how strangers reliably become visitors, and the fastest way to waste money is to judge channels on vibes. Hold each channel’s real spend and real visitors side by side and the guessing stops — one channel is almost always quietly carrying the others.",
    how: [
      "In Campaign Studio, shape the creative and message for each live channel.",
      "Add a traffic block per channel (Meta, Google, organic) with REAL spend and visitor numbers.",
      "Read the cost-per-visitor per channel and note which one is actually earning its budget.",
    ],
    example:
      "Instagram ‘feels’ like it’s working, but the numbers say $6.40/visitor there vs $1.90 from the newsletter — so the next dollar goes to the list, not the grid.",
  },
  "m-sales-system": {
    whatThisIs:
      "A written process for what happens after someone becomes a lead: how they’re qualified, what the follow-up says and when, your booking-to-close steps, and one concrete action for winning back a lead who’s gone quiet.",
    why:
      "Most leads are lost to silence, not rejection. The founder who simply follows up more, on a schedule, beats the one with better ads and no system. Writing it down turns ‘I’ll get to them’ into something that happens whether or not you’re inspired that day.",
    how: [
      "In the Leads Inbox, write your qualification criteria — who’s worth your time.",
      "Write the follow-up cadence (what, when) and your booking-to-close steps.",
      "Write one lost-lead recovery action you’ll actually send to someone who went cold.",
    ],
    example:
      "Recovery action: ‘Day 9, no reply → one line: ‘Should I close your file, or is the timing just off?’’ — it re-opens roughly one in five dead threads.",
  },
  "m-delivery-operations": {
    whatThisIs:
      "Your client promises logged, with an honest read on whether they’re actually kept, plus your real retention and referral rates — the Client Advocacy score, based on reality rather than left blank.",
    why:
      "Retention and referrals come from the same place: keeping the promises you made, consistently. Chasing more reviews before you’ve checked whether today’s promises land is building on sand. This is the least glamorous chapter and often the highest-return one.",
    how: [
      "In Execution, log at least 2 real client promises and mark delivery honestly.",
      "Enter your real retention rate — what share of clients stay.",
      "Enter your real referral rate to build the Client Advocacy score in Business Intelligence.",
    ],
    example:
      "Logging it surfaces that ‘weekly check-ins’ are promised but happen ~60% of the time — fix that one gap and both retention and referrals move without spending a cent on ads.",
  },
  "m-90-day-plan": {
    whatThisIs:
      "The whole system from this chapter turned into a dated, ordered 90-day plan — what gets done, in what order, by when — so ‘what do I do this week’ has an answer every week.",
    why:
      "A system that only exists as knowledge changes nothing; it has to become a schedule. This is the bridge from a defined business to a running one — without dates, the best strategy quietly becomes a someday list. The plan is what carries the momentum past this chapter.",
    how: [
      "In Your Plan, pull in the priorities from Strategic Direction and the build-outs from this chapter.",
      "Order them and put real dates on each — especially the next two weeks.",
      "Make this week’s actions concrete enough to start tomorrow morning.",
    ],
    example:
      "Weeks 1–2: ship the booking funnel + tracking. Weeks 3–4: write and load the 5-touch follow-up. Week 5: turn on paid traffic to the winning channel. Dated, owned, in order.",
  },

  // ── Chapter 3 — Define and Control the Numbers ──────────────────────────────
  "m-personal-freedom-number": {
    whatThisIs:
      "Real Security, Growth and Dream targets set in the Freedom Plan — deciding in advance what the profit is for the day it exists, instead of letting it evaporate into the business.",
    why:
      "Knowing your margin isn’t enough; profit with no assigned job gets reabsorbed and you wonder where it went. Giving each dollar a destination — Security first, then Growth, then Dream — is what turns ‘the business makes money’ into ‘the money changes my life’.",
    how: [
      "In Business Intelligence → Freedom Plan → The Fund, set a Security target: what ‘safe’ looks like in your account.",
      "Set a Growth target: what you’ll reinvest to make the machine bigger.",
      "Set a Dream target: the number that means the vision from Module 1 is real.",
    ],
    example:
      "Security: 6 months’ expenses = $30k. Growth: $2k/mo reinvested. Dream: $40k for the sabbatical. Now every profitable month has somewhere specific to go.",
  },
  "m-price-unit-economics": {
    whatThisIs:
      "The real economics of a single sale: the price, the true cost to deliver one, the margin that’s left, and how many you must sell to break even on what you spend to get them.",
    why:
      "Everything scales on the economics of one sale. If the unit doesn’t work, spending more only loses money faster — growth multiplies a negative. Get this right and every later decision about traffic and price rests on solid ground instead of hope.",
    how: [
      "In Numbers → Break-even, enter your price and the true per-sale cost to deliver.",
      "Read the margin honestly — include the costs you’d rather not count.",
      "Note the break-even quantity: how many sales cover your acquisition spend.",
    ],
    example:
      "Price $4,000, true delivery cost $1,300 → $2,700 margin. If a client costs $600 to acquire, you break even inside the first sale — so scaling traffic is safe.",
  },
  "m-growth-mathematics": {
    whatThisIs:
      "The two or three levers that actually move your revenue — traffic, conversion, price, retention — identified and ranked, so your next 30 days go where the maths pays instead of where it feels busy.",
    why:
      "Revenue is a chain of multipliers: traffic × conversion × price × repeat. A small move on the right link swamps a big move on the wrong one — but most founders push the link they’re most comfortable with, not the one with the most slack. The numbers pick the link for you.",
    how: [
      "In Numbers, open the profit drivers / sensitivity view.",
      "Move each lever a realistic amount and watch what happens to revenue.",
      "Pick the one lever that moves it most for a believable change, and aim the next 30 days at it.",
    ],
    example:
      "Doubling traffic is hard and expensive; lifting the close rate from 25% to 33% is a follow-up tweak — and the sensitivity view shows it adds more revenue. So follow-up wins the month.",
  },
  "m-business-economics": {
    whatThisIs:
      "The whole-business money model on one readable page — total revenue in, fixed and variable costs out, and the profit that actually reaches you — the view that says whether the business, not just the funnel, is healthy.",
    why:
      "Zoom out from one sale to the whole machine and the picture changes: a business that looks busy can be quietly unprofitable, and a modest one can be a quiet cash engine. This is the model that feeds your Freedom Plan targets and tells you the truth about the whole thing.",
    how: [
      "In Numbers, open the business report / money-machine view.",
      "Confirm revenue, fixed and variable costs, and the real profit that lands with you.",
      "Check that profit against the freedom targets you set two modules ago.",
    ],
    example:
      "The funnel looks great, but the whole-business view shows software + contractor costs eating 40% — real profit is $5.5k/mo against a $9k Security target. Now you know the actual gap.",
  },
  "m-plan-vs-actual": {
    whatThisIs:
      "Your projection put next to the real numbers, with the variance named — where you’re ahead, where you’re behind, and by how much — so you steer by what’s happening instead of what you hoped.",
    why:
      "A plan is a hypothesis; reality is the test, and the gap between them is the most useful signal you have. Founders who never compare keep believing the plan; the variance tells you exactly which assumption to revisit next. It’s the difference between running the business and hoping.",
    how: [
      "In Business OS → Review, put your plan next to your actuals.",
      "Find the single biggest variance — the number most different from what you expected.",
      "Name the change it points to; that becomes an input to your improvement loop.",
    ],
    example:
      "Planned 30 leads, got 34 — but planned a 25% close and got 15%. The variance isn’t traffic, it’s closing — so the next experiment is about the sales call, not the ads.",
  },
  "m-improvement-loop": {
    whatThisIs:
      "The habit that outlives the programme: name your riskiest assumptions, pick the riskiest one, run a small test, and — the part most people skip — come back and record what actually happened and what you’ll do about it.",
    why:
      "Every plan rests on beliefs nobody’s tested — ‘this channel keeps converting’, ‘people will pay this’. Left unspoken they harden into facts nobody questioned. A running loop of assumption → test → decision is how the business keeps compounding after the coaching ends.",
    how: [
      "In Business Intelligence → Assumptions, log 3 real assumptions with honest confidence levels.",
      "In Experiments, run one small test tied to your riskiest assumption.",
      "Record the result and a decision: adopt, reject, or iterate.",
    ],
    example:
      "Assumption: ‘Prospects will book without a call.’ Test: add a direct-booking link for 2 weeks. Result: bookings up, show-rate down. Decision: iterate — keep the link, add a confirmation step.",
  },

  // ── Finish ──────────────────────────────────────────────────────────────────
  "m-finish-transformation": {
    whatThisIs:
      "The loop that opened at the Start, closed: your Readiness Score re-checked against the baseline, your single biggest founder-dependency named, and a real plan for the next 90 days so the momentum doesn’t stall the day the programme ‘finishes’.",
    why:
      "Whatever the number says, this is where the change becomes visible and durable. The gap between your first score and this one is the transformation, made concrete. And naming the one thing only you can currently do is how you stop being the bottleneck to your own growth.",
    how: [
      "Re-check your Readiness Score and compare it honestly to your Start baseline.",
      "Name your biggest founder-dependency — the thing that only works because you do it — and one step to reduce it.",
      "Write your next 90-day focus so there’s a clear ‘what’s next’ the day this ends.",
    ],
    example:
      "Readiness 21 → 58. Biggest dependency: ‘Every sales call is me.’ Step: ‘Record 3 calls, write the script, hand two calls to a closer next month.’ Next 90 days: ‘Take myself out of first-touch sales.’",
  },
};

/** The manual teaching for a module id, or null if none is authored (the guided
 *  page then falls back to the engine's base `content` paragraph). */
export function manualTeachingFor(lessonId: string): ModuleTeaching | null {
  return MANUAL_TEACHING[lessonId] ?? null;
}
