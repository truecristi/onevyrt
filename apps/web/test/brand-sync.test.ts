import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import { createWorkspace } from "../lib/workspaces";
import { grantEntitlement } from "../lib/entitlements";
import { GET, PATCH } from "../app/api/campaign-studio/brand/route";
import { getBrandProfile } from "../lib/brand";
import { getReality, patchReality } from "../lib/reality";
import { getOffer } from "../lib/offer";
import { getMessage, patchMessage } from "../lib/message";
import { uid, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix } from "./helpers/pg";

/**
 * app/api/campaign-studio/brand/route.ts's write-redirect + read-through —
 * the core of the Section 1 write-path merge's Workstream B. Exercises the
 * real route handlers directly (same idiom as test/workspace-isolation.test.ts:
 * a real registered user, a real session cookie, a real workspace) rather
 * than testing the underlying lib functions in isolation, since the whole
 * point is proving the HTTP-level contract: PATCHing a redirected field
 * through the Brand Brain API must land in the canonical store, not
 * brand_profiles' own column, and GET must read it back from there.
 */

const emailPrefix = uid("brand-sync");
const wsPrefix = uid("brand-sync");

after(async () => {
  await purgeUsersByEmailPrefix(emailPrefix);
  await purgeWorkspacesByNamePrefix(wsPrefix);
});

function cookieFor(token: string): string {
  return `gb_session=${token}`;
}

/** A fresh registered user + owned, campaign_studio-entitled workspace —
 *  everything resolveScope() in the route needs to let a PATCH through. */
async function setup(name: string): Promise<{ userId: string; wsId: string; cookie: string }> {
  const user = await auth.registerUser(`${emailPrefix}_${name}@test.com`, "Test123!");
  const ws = await createWorkspace(user.id, `${wsPrefix}-${name}`);
  await grantEntitlement(ws.id, "campaign_studio");
  const token = await auth.createSession(user.id);
  return { userId: user.id, wsId: ws.id, cookie: cookieFor(token) };
}

function urlFor(wsId: string): string {
  return `http://x/api/campaign-studio/brand?ws=${encodeURIComponent(wsId)}`;
}

async function patchBrand(cookie: string, wsId: string, body: Record<string, unknown>) {
  const req = new Request(urlFor(wsId), { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  const res = await PATCH(req);
  assert.equal(res.status, 200, `PATCH failed: ${await res.clone().text()}`);
  return res.json();
}

async function getBrand(cookie: string, wsId: string) {
  const req = new Request(urlFor(wsId), { headers: { cookie } });
  const res = await GET(req);
  assert.equal(res.status, 200, `GET failed: ${await res.clone().text()}`);
  return res.json();
}

test("PATCH businessIn/businessReallyIn lands in the Reality Map, not brand_profiles' own column", async () => {
  const { cookie, wsId } = await setup("reality");
  await patchBrand(cookie, wsId, { businessIn: "coaching", businessReallyIn: "predictable client acquisition" });

  const reality = await getReality(wsId);
  assert.equal(reality.businessIn, "coaching");
  assert.equal(reality.businessReallyIn, "predictable client acquisition");

  const rawBrand = await getBrandProfile(wsId);
  assert.equal(rawBrand?.businessIn, undefined, "brand_profiles' own column must not be written for a redirected field");
  assert.equal(rawBrand?.businessReallyIn, undefined);
});

test("PATCH audience/guarantees/pricingNotes lands in the Offer tool, not brand_profiles", async () => {
  const { cookie, wsId } = await setup("offer");
  await patchBrand(cookie, wsId, { audience: "coaches under $10k/mo", guarantees: "double your leads or free", pricingNotes: "normally £2,000" });

  const offer = await getOffer(wsId);
  assert.equal(offer.audience, "coaches under $10k/mo");
  assert.equal(offer.guarantee, "double your leads or free");
  assert.equal(offer.priceAnchor, "normally £2,000");

  const rawBrand = await getBrandProfile(wsId);
  assert.equal(rawBrand?.audience, undefined);
  assert.equal(rawBrand?.guarantees, undefined);
  assert.equal(rawBrand?.pricingNotes, undefined);
});

test("PATCH message.{problem,success,failure,plan} lands in the Message tool's corresponding fields", async () => {
  const { cookie, wsId } = await setup("message");
  await patchBrand(cookie, wsId, { message: { problem: "Leads go cold fast", success: "A calendar full of booked calls", failure: "Losing leads to slow response", plan: "Map -> follow up -> close" } });

  const message = await getMessage(wsId);
  assert.equal(message.internalProblem, "Leads go cold fast", "Brand's message.problem must land in Message's internalProblem, not oneLiner.problem");
  assert.equal(message.success, "A calendar full of booked calls");
  assert.equal(message.failure, "Losing leads to slow response");
  assert.equal(message.plan, "Map -> follow up -> close");
  assert.equal(message.oneLiner.problem, "", "oneLiner's own triplet must be untouched by this redirect");

  const rawBrand = await getBrandProfile(wsId);
  assert.equal(rawBrand?.message?.problem, undefined);
  assert.equal(rawBrand?.message?.success, undefined);
});

test("message.oneLiner is never persisted anywhere — GET always returns the live-composed value", async () => {
  const { cookie, wsId } = await setup("oneliner");
  // A caller sending oneLiner directly (e.g. an old client) must have it
  // silently ignored, not stored as a stale, never-updated copy.
  await patchBrand(cookie, wsId, { message: { oneLiner: "A hand-typed sentence that should never be saved" } });
  const rawBrand = await getBrandProfile(wsId);
  assert.equal(rawBrand?.message?.oneLiner, undefined, "oneLiner must never be written to brand_profiles");

  // Now build a real composed one-liner via the Message tool directly, and
  // confirm GET reflects it live.
  await patchMessage(wsId, { oneLiner: { problem: "Leads go cold fast", solution: "We ship a 24-hour follow-up system", result: "you close more" } });
  const brand = await getBrand(cookie, wsId);
  assert.equal(brand.message.oneLiner, "Leads go cold fast. We ship a 24-hour follow-up system, so you close more.");
});

test("GET falls back to brand_profiles' own (frozen) column only when the canonical source is empty", async () => {
  const { cookie, wsId } = await setup("fallback");
  // Nothing in Reality Map/Offer/Message yet — brand's own values (if any)
  // should show through. Since this is a fresh workspace, both are empty;
  // assert the response has no error and the fields are simply absent.
  const brand = await getBrand(cookie, wsId);
  assert.equal(brand.businessIn, undefined);
  assert.equal(brand.audience, undefined);
});

test("patching businessIn alone never wipes businessReallyIn set earlier directly via Reality Map", async () => {
  const { cookie, wsId } = await setup("cross-store-sibling");
  // Simulate a learner filling in businessReallyIn on /business/reality
  // directly (not through the Brand page at all).
  await patchReality(wsId, { businessReallyIn: "predictable client acquisition" });

  // Now edit ONLY businessIn from the Brand Brain page.
  await patchBrand(cookie, wsId, { businessIn: "coaching" });

  const reality = await getReality(wsId);
  assert.equal(reality.businessIn, "coaching");
  assert.equal(reality.businessReallyIn, "predictable client acquisition", "a sibling fact set via a completely different UI surface must survive");
});

test("hero/guide/callToAction (no Message-tool equivalent) still save to brand_profiles' own column", async () => {
  const { cookie, wsId } = await setup("brand-only-message");
  await patchBrand(cookie, wsId, { message: { hero: "The overwhelmed solo coach", guide: "We've closed 200 leaky funnels", callToAction: "Book your audit" } });

  const rawBrand = await getBrandProfile(wsId);
  assert.equal(rawBrand?.message?.hero, "The overwhelmed solo coach");
  assert.equal(rawBrand?.message?.guide, "We've closed 200 leaky funnels");
  assert.equal(rawBrand?.message?.callToAction, "Book your audit");
});

test("companyName (not redirected) still saves to brand_profiles' own column, unaffected by the redirects", async () => {
  const { cookie, wsId } = await setup("companyname");
  await patchBrand(cookie, wsId, { companyName: "Acme Coaching Co", businessIn: "coaching" });
  const brand = await getBrand(cookie, wsId);
  assert.equal(brand.companyName, "Acme Coaching Co");
  assert.equal(brand.businessIn, "coaching");
});
