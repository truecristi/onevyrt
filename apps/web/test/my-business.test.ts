import test, { after } from "node:test";
import assert from "node:assert/strict";
import { assembleMyBusiness, myBusinessCompleteness } from "@onevyrt/engine";
import * as auth from "../lib/auth";
import { uid, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix } from "./helpers/pg";
import { ensurePersonalWorkspace } from "../lib/workspaces";
import { getBusiness, saveBusinessSection } from "../lib/business";
import { getBrandProfile, upsertBrandProfile } from "../lib/brand";
import { getConstraint, saveConstraint } from "../lib/constraint";
import { getOffer, saveOffer } from "../lib/offer";
import { getMessage, saveMessage, composeOneLiner } from "../lib/message";

/**
 * My Business integration tests
 *
 * Tests the unified profile assembly from its data sources:
 * - FunnelDoc BusinessDefinition
 * - Business-OS Reality Map, Growth Constraint, Offer, Message
 * - Brand Profile
 *
 * Pure function tests in @onevyrt/engine; these cover the integration
 * of data loading and precedence resolution in the app layer.
 */

const emailPrefix = uid("mybiz");
const wsPrefix = uid("mybiz");

after(async () => {
  await purgeUsersByEmailPrefix(emailPrefix);
  await purgeWorkspacesByNamePrefix(wsPrefix);
});

// ── Data Loading & Assembly ────

test("assembleMyBusiness with no data sources returns minimal profile", async () => {
  const myBusiness = assembleMyBusiness({
    definition: undefined,
    reality: undefined,
    brand: undefined,
  });

  assert.ok(myBusiness);
  assert.equal(myBusiness.identity.name, undefined);
  assert.equal(myBusiness.identity.description, undefined);
  assert.equal(myBusiness.identity.industry, undefined);
});

test("assembleMyBusiness with business definition only uses that as the source", () => {
  const definition = {
    businessName: "Acme Corp",
    currentReality: "We make widgets",
    whoServe: "Small businesses",
  };

  const myBusiness = assembleMyBusiness({
    definition,
    reality: undefined,
    brand: undefined,
  });

  assert.equal(myBusiness.identity.name, "Acme Corp");
  assert.equal(myBusiness.identity.description, "We make widgets");
  assert.equal(myBusiness.customer.whoYouServe, "Small businesses");
});

test("assembleMyBusiness resolves each field from its higher-precedence source when multiple sources provide it", () => {
  const definition = {
    currentReality: "From Definition",
    whoServe: "Definition's audience",
    milestones: "Definition's 3-year milestone",
  };

  const reality = {
    want36m: "Reality's 3-year vision",
  };

  const brand = {
    description: "From Brand",
    audience: "Brand's audience",
  };

  const myBusiness = assembleMyBusiness({
    definition,
    reality,
    brand,
  });

  // Brand's description wins over the definition's currentReality fallback.
  assert.equal(myBusiness.identity.description, "From Brand");
  // Definition's whoServe wins over brand's audience.
  assert.equal(myBusiness.customer.whoYouServe, "Definition's audience");
  // Reality's want36m wins over the definition's milestones fallback.
  assert.equal(myBusiness.direction.want36m, "Reality's 3-year vision");
});

test("assembleMyBusiness merges all fields preserving existing data", () => {
  const definition = {
    businessName: "TestCorp",
    currentReality: "Test business description",
  };

  const reality = {
    now: { revenue: "50000", profit: "5000" },
  };

  const brand = {
    industry: "Services",
    audience: "SMBs",
  };

  const myBusiness = assembleMyBusiness({
    definition,
    reality,
    brand,
  });

  // All fields present
  assert.equal(myBusiness.identity.name, "TestCorp");
  assert.equal(myBusiness.identity.description, "Test business description");
  assert.equal(myBusiness.numbers.revenue, "50000");
  assert.equal(myBusiness.numbers.profit, "5000");
  assert.equal(myBusiness.identity.industry, "Services");
  assert.equal(myBusiness.customer.whoYouServe, "SMBs");
});

// ── Completeness Calculation ────

test("myBusinessCompleteness calculates profile fill rate", () => {
  const emptyProfile = assembleMyBusiness({
    definition: undefined,
    reality: undefined,
    brand: undefined,
  });

  const completeness1 = myBusinessCompleteness(emptyProfile);
  assert.ok(completeness1.percent <= 20); // Very low for empty profile

  const fullDefinition = {
    businessName: "Corp",
    whoServe: "Enterprises",
    mainOffer: "Growth coaching",
    currentReality: "Established consultancy",
    breakthrough: "Productising the offer",
    vision: "Category leader",
    milestones: "Double revenue in 3 years",
    mainConstraint: "Sales capacity",
    mainOpportunity: "Untapped enterprise segment",
    currentState: "Founder-led sales",
    currentStory: "Started as a solo consultant",
    newStory: "Now a repeatable system",
    strategy: "Land and expand",
    weeklyFocus: "Close the two open enterprise deals",
  };

  const fullProfile = assembleMyBusiness({
    definition: fullDefinition,
    reality: {
      businessReallyIn: "Enterprise transformation",
      want12m: "1M ARR",
      want36m: "5M ARR",
      targetRevenue: "5000000",
      now: { revenue: "1000000", profit: "300000", customers: "40", team: "6", stage: "growth" },
    },
    brand: {
      industry: "Tech",
      description: "Tech company",
      audience: "Enterprises",
      customerProblem: "Can't scale sales",
      customerSuccess: "Predictable enterprise pipeline",
      messageOneLiner: "We turn founders into category leaders",
      guarantees: "Results in 90 days",
      pricingNotes: "Value-based pricing",
      brandVoice: "Confident and direct",
      competitors: "BigCoachCo, ScaleUp Inc",
    },
  });

  const completeness2 = myBusinessCompleteness(fullProfile);
  assert.ok(completeness2.percent >= 80); // High for full profile
});

test("myBusinessCompleteness identifies incomplete sections", () => {
  const partialProfile = assembleMyBusiness({
    definition: {
      businessName: "TestCo",
      // Missing most definition fields
    },
    reality: {
      // Missing revenue, growth, etc.
    },
    brand: {
      industry: "Services",
      // Missing companyName-equivalent, audience, etc.
    },
  });

  const completeness = myBusinessCompleteness(partialProfile);
  assert.ok(completeness.percent > 0);
  assert.ok(completeness.percent < 100); // Partially complete
});

// ── Database Integration ────

test("getBusiness retrieves reality map from workspace data", async () => {
  const email = `${emailPrefix}@test.com`;
  const user = await auth.registerUser(email, "Test123!");
  const workspace = await ensurePersonalWorkspace(user.id);

  const realityMap = {
    now: { revenue: "25000", customers: "50" },
    want12m: "50000",
    want36m: "100000",
  };

  // Set business data
  await saveBusinessSection(workspace.id, "realityMap", realityMap);

  // Retrieve it
  const retrieved = await getBusiness(workspace.id);
  assert.deepEqual(retrieved.realityMap, realityMap);
});

test("getBrandProfile retrieves brand data from workspace", async () => {
  const email = `${emailPrefix}_brand@test.com`;
  const user = await auth.registerUser(email, "Test123!");
  const workspace = await ensurePersonalWorkspace(user.id);

  const brandData = {
    companyName: "Test Brand",
    industry: "Consulting",
    description: "A consulting firm",
    audience: "Mid-market SaaS",
    competitors: "CompetitorA, CompetitorB",
    guarantees: "30-day money back",
    pricingNotes: "Premium pricing",
    brandVoice: "Professional",
    message: {
      oneLiner: "Transform your business",
      problem: "Struggling with growth",
      success: "Scaling to 7 figures",
    },
  };

  await upsertBrandProfile(workspace.id, brandData);
  const retrieved = await getBrandProfile(workspace.id);

  assert.equal(retrieved?.companyName, "Test Brand");
  assert.equal(retrieved?.industry, "Consulting");
  assert.equal(retrieved?.competitors, "CompetitorA, CompetitorB");
});

test("assembleMyBusiness integrates real database sources correctly", async () => {
  const email = `${emailPrefix}_integrated@test.com`;
  const user = await auth.registerUser(email, "Test123!");
  const workspace = await ensurePersonalWorkspace(user.id);
  const wsId = workspace.id;

  // Set up business data
  const business = {
    now: { revenue: "30000", customers: "100" },
  };
  await saveBusinessSection(wsId, "realityMap", business);

  // Set up brand data
  const brand = {
    companyName: "IntegrationTest Inc",
    industry: "Technology",
    description: "Test company",
    audience: "Startups",
  };
  await upsertBrandProfile(wsId, brand);

  // Assemble from sources
  const [businessData, brandData] = await Promise.all([getBusiness(wsId), getBrandProfile(wsId)]);

  const assembled = assembleMyBusiness({
    definition: undefined,
    reality: businessData.realityMap,
    brand: brandData
      ? {
          companyName: brandData.companyName,
          industry: brandData.industry,
          description: brandData.description,
          audience: brandData.audience,
          competitors: brandData.competitors,
          guarantees: brandData.guarantees,
          pricingNotes: brandData.pricingNotes,
          brandVoice: brandData.brandVoice,
          messageOneLiner: brandData.message?.oneLiner,
          customerProblem: brandData.message?.problem,
          customerSuccess: brandData.message?.success,
        }
      : undefined,
  });

  assert.equal(assembled.identity.name, "IntegrationTest Inc");
  assert.equal(assembled.identity.industry, "Technology");
  assert.equal(assembled.numbers.revenue, "30000");
  assert.equal(assembled.customer.whoYouServe, "Startups");
});

test("assembleMyBusiness picks up the Growth Constraint, Offer and Message Business-OS tools from real database rows", async () => {
  const email = `${emailPrefix}_tools@test.com`;
  const user = await auth.registerUser(email, "Test123!");
  const workspace = await ensurePersonalWorkspace(user.id);
  const wsId = workspace.id;

  await saveConstraint(wsId, {
    areas: [{ id: "a1", area: "Sales & closing", severity: 4, evidence: "8.2% close rate" }],
    chosen: "Sales & closing", why: "Strong leads, poor follow-up.", relieve: "Ship a 24-hour follow-up SOP.", stopDoing: "",
  });
  await saveOffer(wsId, { name: "The Funnel Fix Sprint", guarantee: "double your leads or free", priceAnchor: "normally £2,000" });
  await saveMessage(wsId, {
    oneLiner: { problem: "Leads go cold fast", solution: "We ship a 24-hour follow-up system", result: "you close more of what you already pay for" },
    character: "", wants: "", internalProblem: "", plan: "", success: "", failure: "",
  });

  const [constraint, offer, message] = await Promise.all([getConstraint(wsId), getOffer(wsId), getMessage(wsId)]);

  const assembled = assembleMyBusiness({
    constraint: { chosen: constraint.chosen },
    offer: { name: offer.name, guarantee: offer.guarantee, priceAnchor: offer.priceAnchor },
    message: { oneLiner: composeOneLiner(message) },
  });

  assert.equal(assembled.strategy.mainConstraint, "Sales & closing");
  assert.equal(assembled.offer.mainOffer, "The Funnel Fix Sprint");
  assert.equal(assembled.offer.guarantees, "double your leads or free");
  assert.equal(assembled.offer.pricingNotes, "normally £2,000");
  assert.equal(assembled.message.oneLiner, "Leads go cold fast. We ship a 24-hour follow-up system, so you close more of what you already pay for.");
});

// ── Edge Cases ────

test("assembleMyBusiness with empty objects is equivalent to undefined", () => {
  const assembled1 = assembleMyBusiness({
    definition: undefined,
    reality: undefined,
    brand: undefined,
  });

  const assembled2 = assembleMyBusiness({
    definition: {},
    reality: {},
    brand: {},
  } as any);

  // Both should have minimal/no content
  assert.ok(!assembled1.identity.name || !assembled2.identity.name || assembled1.identity.name === assembled2.identity.name);
});

test("assembleMyBusiness correctly handles undefined reality fields", () => {
  const reality = {
    targetRevenue: undefined,
    now: { revenue: undefined },
  };

  const profile = assembleMyBusiness({
    definition: undefined,
    reality,
    brand: {
      companyName: "Test",
    },
  });

  assert.equal(profile.identity.name, "Test");
  // Undefined fields should not appear in result or be null
  assert.ok(profile.numbers.revenue === undefined || profile.numbers.revenue === null);
});
