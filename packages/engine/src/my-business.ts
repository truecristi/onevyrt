/**
 * "My Business" — the single, unified business profile the Phase 2 spec asks for
 * (docs/ONEVYRT_NAVIGATION_AND_USER_FLOW.md §5): the learner enters a fact ONCE
 * and it appears everywhere it's needed. Today the same facts are scattered
 * across three stores with different field names — the project doc's
 * BusinessDefinition, the Business-OS Reality Map (workspace_business), and the
 * Brand Brain (brand_profiles). This module resolves them into one canonical
 * profile with an explicit precedence, so every surface reads the same answer
 * instead of each feature asking again.
 *
 * Pure: no storage. The web layer adapts its DB rows into MyBusinessInputs (the
 * decoupled input shapes below) and calls assembleMyBusiness(); the engine owns
 * the precedence rules and the unified shape.
 */
import type { BusinessDefinition } from "./program.ts";

/** Reality Map fields we read (subset of the web BusinessRealityMap). */
export interface MyBusinessRealityInput {
  businessIn?: string;
  businessReallyIn?: string;
  businessNeedToBeIn?: string;
  now?: { revenue?: string; profit?: string; customers?: string; team?: string; stage?: string };
  want12m?: string;
  want36m?: string;
  targetRevenue?: string;
}

/** Brand Brain fields we read (subset of the web BrandProfile, flattened). */
export interface MyBusinessBrandInput {
  companyName?: string;
  industry?: string;
  description?: string;
  audience?: string;
  competitors?: string;
  guarantees?: string;
  pricingNotes?: string;
  brandVoice?: string;
  messageOneLiner?: string;
  customerProblem?: string;
  customerSuccess?: string;
}

/** Growth Constraint fields we read (subset of lib/constraint.ts's ConstraintData —
 *  just the declared current constraint, not the full scored-areas list). */
export interface MyBusinessConstraintInput {
  chosen?: string;
}

/** Offer fields we read (subset of lib/studio/offer-coach.ts's OfferData). */
export interface MyBusinessOfferInput {
  name?: string;
  guarantee?: string;
  priceAnchor?: string;
}

/** Message fields we read. oneLiner is the already-composed sentence (lib/message.ts's
 *  composeOneLiner output), not the raw problem/solution/result parts — the web
 *  layer composes it before handing it to this pure function. */
export interface MyBusinessMessageInput {
  oneLiner?: string;
}

export interface MyBusinessInputs {
  definition?: Partial<BusinessDefinition>;
  reality?: MyBusinessRealityInput;
  brand?: MyBusinessBrandInput;
  /** Business-OS Growth Constraint tool (lib/constraint.ts) — the dedicated,
   *  ongoing-maintained mechanism for "what's the one thing limiting growth
   *  right now", distinct from the one-time BusinessDefinition.mainConstraint
   *  entered during guided onboarding. */
  constraint?: MyBusinessConstraintInput;
  /** Business-OS Offer tool (lib/offer.ts) — distinct from Brand Brain's own
   *  guarantees/pricingNotes fields; both are read, offer tool preferred. */
  offer?: MyBusinessOfferInput;
  /** Business-OS Message tool (lib/message.ts) — the dedicated one-liner
   *  builder, distinct from Brand Brain's own messageOneLiner field. */
  message?: MyBusinessMessageInput;
}

/** The unified profile, organised as the spec lists it. Every field optional —
 *  the profile fills in as the programme is completed. */
export interface ProgrammeOutput {
  stageId: string;
  title: string;
  outputName?: string;
  status: "not_started" | "in_progress" | "awaiting_review" | "changes_requested" | "approved" | "locked";
  submittedAt?: string;
  approvedAt?: string;
  coachName?: string;
  coachEmail?: string;
  coachFeedback?: string;
  lessonsComplete?: number;
  lessonsTotal?: number;
  data?: Record<string, unknown>;
}

export interface MyBusiness {
  identity: { name?: string; industry?: string; description?: string; businessYouAreReallyIn?: string };
  direction: { vision?: string; want12m?: string; want36m?: string; targetRevenue?: string; breakthrough?: string };
  customer: { whoYouServe?: string; theirProblem?: string; theirSuccess?: string };
  transformation: { currentState?: string; currentStory?: string; newStory?: string };
  message: { oneLiner?: string };
  strategy: { strategy?: string; mainOpportunity?: string; mainConstraint?: string };
  offer: { mainOffer?: string; guarantees?: string; pricingNotes?: string };
  brand: { voice?: string; competitors?: string };
  numbers: { revenue?: string; profit?: string; customers?: string; team?: string; stage?: string; targetRevenue?: string };
  next90: { weeklyFocus?: string };
  programmeOutputs?: ProgrammeOutput[];
}

/** First non-empty (trimmed) value, else undefined — the precedence primitive. */
function firstOf(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

/**
 * Resolve the six sources into one profile. Precedence favours the most
 * specific/authored source for each fact: the guided BusinessDefinition first
 * for identity, the Reality Map for current numbers and horizons, the Brand
 * Brain for outward positioning, and the three dedicated Business-OS tools
 * (Growth Constraint, Offer, Message) for the facts they each own and keep
 * current — each falling back to the others where a field is blank, so a
 * fact entered anywhere shows up here.
 */
export function assembleMyBusiness(inputs: MyBusinessInputs): MyBusiness {
  const d = inputs.definition ?? {};
  const r = inputs.reality ?? {};
  const b = inputs.brand ?? {};
  const c = inputs.constraint ?? {};
  const o = inputs.offer ?? {};
  const m = inputs.message ?? {};
  const now = r.now ?? {};

  return {
    identity: {
      name: firstOf(d.businessName, b.companyName),
      industry: firstOf(b.industry),
      description: firstOf(b.description, d.currentReality),
      businessYouAreReallyIn: firstOf(r.businessReallyIn, r.businessIn, r.businessNeedToBeIn),
    },
    direction: {
      vision: firstOf(d.vision),
      want12m: firstOf(r.want12m),
      want36m: firstOf(r.want36m, d.milestones),
      targetRevenue: firstOf(r.targetRevenue),
      breakthrough: firstOf(d.breakthrough, d.mainOpportunity),
    },
    customer: {
      whoYouServe: firstOf(d.whoServe, b.audience),
      theirProblem: firstOf(b.customerProblem),
      theirSuccess: firstOf(b.customerSuccess),
    },
    transformation: {
      currentState: firstOf(d.currentState, d.currentReality),
      currentStory: firstOf(d.currentStory),
      newStory: firstOf(d.newStory),
    },
    message: {
      oneLiner: firstOf(m.oneLiner, b.messageOneLiner),
    },
    strategy: {
      strategy: firstOf(d.strategy),
      mainOpportunity: firstOf(d.mainOpportunity),
      // The Growth Constraint tool is the ongoing-maintained source (the
      // whole point of that tool is to keep this current); the guided
      // definition's mainConstraint is a one-time onboarding answer that
      // can go stale, so it's only the fallback.
      mainConstraint: firstOf(c.chosen, d.mainConstraint),
    },
    offer: {
      mainOffer: firstOf(d.mainOffer, o.name),
      guarantees: firstOf(o.guarantee, b.guarantees),
      pricingNotes: firstOf(b.pricingNotes, o.priceAnchor),
    },
    brand: {
      voice: firstOf(b.brandVoice),
      competitors: firstOf(b.competitors),
    },
    numbers: {
      revenue: firstOf(now.revenue),
      profit: firstOf(now.profit),
      customers: firstOf(now.customers),
      team: firstOf(now.team),
      stage: firstOf(now.stage),
      targetRevenue: firstOf(r.targetRevenue),
    },
    next90: {
      weeklyFocus: firstOf(d.weeklyFocus),
    },
  };
}

export interface MyBusinessCompleteness {
  filled: number;
  total: number;
  percent: number;
  /** Section id → whether it has at least one filled field (for section badges). */
  bySection: Record<keyof MyBusiness, boolean>;
}

/** How "built" the profile is — drives the My Business progress indicator and
 *  the Transformation Report's before/after. Counts filled leaf fields.
 *  Excludes programmeOutputs (which is metadata, not profile content). */
export function myBusinessCompleteness(mb: MyBusiness): MyBusinessCompleteness {
  let filled = 0;
  let total = 0;
  const bySection = {} as Record<keyof MyBusiness, boolean>;
  for (const section of Object.keys(mb) as (keyof MyBusiness)[]) {
    // Skip programmeOutputs — it's a metadata array, not leaf fields to count
    if (section === "programmeOutputs") continue;

    const sectionData = mb[section];
    if (!sectionData || typeof sectionData !== "object") continue;

    const fields = Object.values(sectionData);
    let any = false;
    for (const v of fields) {
      total++;
      if (typeof v === "string" && v.trim() !== "") { filled++; any = true; }
    }
    bySection[section] = any;
  }
  return { filled, total, percent: total === 0 ? 0 : Math.round((filled / total) * 100), bySection };
}
