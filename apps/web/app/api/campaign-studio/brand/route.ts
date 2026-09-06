/**
 * Campaign Studio — Brand Brain API. Gated behind the campaign_studio
 * entitlement (see lib/entitlements.ts): a workspace either has it via plan
 * (Performance) or as a purchased add-on, checked the same way either way.
 *
 * Several BrandProfile fields overlap with facts other Business-OS tools
 * already own more specifically. PATCH redirects those specific fields into
 * their canonical store INSTEAD OF brand_profiles' own column (never a
 * shadow write — two writers of the same fact is exactly the "one canonical
 * programme" gap this closes); GET reads them back FROM the canonical
 * store, falling back to brand's own (now-frozen, pre-migration) column
 * only when the canonical source has nothing. Old data already sitting in
 * brand_profiles is never deleted or migrated — it just stops being the
 * write target for these specific fields going forward. See
 * docs/IMPLEMENTATION_ROADMAP.md's "Business-data duplication" section for
 * the full picture across all five stores.
 *
 * Field mapping (verified against lib/brand.ts's and lib/message.ts's own
 * doc comments, not assumed):
 *   businessIn / businessReallyIn -> lib/reality.ts (workspace_business.realityMap)
 *   audience                      -> lib/offer.ts's `audience`
 *   guarantees / pricingNotes     -> lib/offer.ts's `guarantee` / `priceAnchor`
 *   message.problem               -> lib/message.ts's `internalProblem`
 *     ("the problem stopping them" reads as the internal/emotional framing
 *     lib/message.ts's story-grid `internalProblem` field owns, not the
 *     punchier, more literal `oneLiner.problem` — "the pain the customer
 *     is in")
 *   message.success                -> lib/message.ts's `success` (identical doc
 *     comment on both sides: "what winning looks like")
 *   message.failure                -> lib/message.ts's `failure` (identical doc
 *     comment on both sides: "the stakes... what they avoid")
 *   message.plan                   -> lib/message.ts's `plan` (identical concept
 *     on both sides: the simple plan/steps)
 *   message.oneLiner (the composed sentence) -> never stored anywhere going
 *     forward; always computed live via lib/message.ts's composeOneLiner()
 *     from the Message tool's own oneLiner {problem,solution,result} triplet
 *   message.hero / .guide / .callToAction -> stay brand_profiles' own; no
 *     clean 1:1 Message-tool equivalent (hero is a composite of Message's
 *     character+wants, not a single field — redirecting it would be a
 *     lossy guess, which this whole approach deliberately avoids)
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { hasEntitlement } from "../../../../lib/entitlements";
import { getBrandProfile, upsertBrandProfile, MAX_LOGO, type BrandProfile, type BrandProfilePatch, type BrandProduct, type BrandTestimonial, type BrandMessage } from "../../../../lib/brand";
import { getReality, patchReality, type BusinessRealityMap } from "../../../../lib/reality";
import { getOffer, patchOffer, type OfferData } from "../../../../lib/offer";
import { getMessage, patchMessage, composeOneLiner, type MessageData, type MessagePatch } from "../../../../lib/message";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the brand profile" }, 403);
  if (!(await hasEntitlement(wsId, "campaign_studio"))) return json({ error: "Campaign Studio isn't enabled for this workspace" }, 403);
  return { wsId, role };
}

const s = (v?: string): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** Merges the canonical-store values on top of brand_profiles' own row for
 *  the fields this route redirects — the canonical source wins whenever it
 *  has something, brand's own (frozen, pre-migration) column is shown only
 *  as a fallback for data that predates this change. Purely a read-time
 *  overlay; never persisted back. */
function readThrough(wsId: string, profile: BrandProfile | null, reality: BusinessRealityMap, offer: OfferData, message: MessageData): BrandProfile {
  const now = new Date().toISOString();
  const base: BrandProfile = profile ?? { workspaceId: wsId, prohibitedWords: [], products: [], testimonials: [], createdAt: now, updatedAt: now };
  return {
    ...base,
    businessIn: s(reality.businessIn) ?? base.businessIn,
    businessReallyIn: s(reality.businessReallyIn) ?? base.businessReallyIn,
    audience: s(offer.audience) ?? base.audience,
    guarantees: s(offer.guarantee) ?? base.guarantees,
    pricingNotes: s(offer.priceAnchor) ?? base.pricingNotes,
    message: {
      ...base.message,
      oneLiner: s(composeOneLiner(message)) ?? base.message?.oneLiner,
      problem: s(message.internalProblem) ?? base.message?.problem,
      success: s(message.success) ?? base.message?.success,
      failure: s(message.failure) ?? base.message?.failure,
      plan: s(message.plan) ?? base.message?.plan,
    },
  };
}

export const GET = withRouteLogging("api/campaign-studio/brand:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  const [profile, reality, offer, message] = await Promise.all([
    getBrandProfile(scope.wsId), getReality(scope.wsId), getOffer(scope.wsId), getMessage(scope.wsId),
  ]);
  return json(readThrough(scope.wsId, profile, reality, offer, message));
});

function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : undefined;
}
function asProducts(v: unknown): BrandProduct[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.every((p) => p && typeof p === "object" && typeof (p as { name?: unknown }).name === "string")
    ? (v as BrandProduct[]) : undefined;
}
function asTestimonials(v: unknown): BrandTestimonial[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.every((t) => t && typeof t === "object" && typeof (t as { quote?: unknown }).quote === "string")
    ? (v as BrandTestimonial[]) : undefined;
}
function asString(v: unknown): string | undefined { return typeof v === "string" ? v : undefined; }
const MESSAGE_KEYS: (keyof BrandMessage)[] = ["hero", "problem", "guide", "plan", "callToAction", "success", "failure", "oneLiner"];
function asMessage(v: unknown): BrandMessage | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: BrandMessage = {};
  for (const k of MESSAGE_KEYS) {
    const val = (v as Record<string, unknown>)[k];
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

export const PATCH = withRouteLogging("api/campaign-studio/brand:PATCH", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  try {
    const patch: BrandProfilePatch = {};
    if (body.websiteUrl !== undefined) patch.websiteUrl = asString(body.websiteUrl) ?? "";
    if (body.companyName !== undefined) patch.companyName = asString(body.companyName) ?? "";
    if (body.industry !== undefined) patch.industry = asString(body.industry) ?? "";
    if (body.description !== undefined) patch.description = asString(body.description) ?? "";
    if (body.logoUrl !== undefined) {
      const logo = asString(body.logoUrl) ?? "";
      // Reject an oversized logo outright rather than silently truncating it —
      // a truncated data: URL is corrupt (broken image, no error shown).
      if (logo.length > MAX_LOGO) return json({ error: "Logo is too large — please use a smaller image." }, 400);
      patch.logoUrl = logo;
    }
    if (body.primaryColor !== undefined) patch.primaryColor = asString(body.primaryColor) ?? "";
    if (body.primaryColorName !== undefined) patch.primaryColorName = asString(body.primaryColorName) ?? "";
    if (body.secondaryColor !== undefined) patch.secondaryColor = asString(body.secondaryColor) ?? "";
    if (body.secondaryColorName !== undefined) patch.secondaryColorName = asString(body.secondaryColorName) ?? "";
    if (body.language !== undefined) patch.language = asString(body.language) ?? "";
    if (body.brandVoice !== undefined) patch.brandVoice = asString(body.brandVoice) ?? "";
    if (body.competitors !== undefined) patch.competitors = asString(body.competitors) ?? "";
    if (body.locations !== undefined) patch.locations = asString(body.locations) ?? "";
    if (body.prohibitedWords !== undefined) {
      const arr = asStringArray(body.prohibitedWords);
      if (!arr) return json({ error: "prohibitedWords must be an array of strings" }, 400);
      patch.prohibitedWords = arr;
    }
    if (body.products !== undefined) {
      const arr = asProducts(body.products);
      if (!arr) return json({ error: "products must be an array of { name, description?, price? }" }, 400);
      patch.products = arr;
    }
    if (body.testimonials !== undefined) {
      const arr = asTestimonials(body.testimonials);
      if (!arr) return json({ error: "testimonials must be an array of { quote, author? }" }, 400);
      patch.testimonials = arr;
    }

    // businessIn/businessReallyIn/audience/guarantees/pricingNotes and most
    // of `message` are NOT added to `patch` (brand_profiles' own columns) —
    // they're redirected to their canonical store below instead. See this
    // file's module doc comment for the full field mapping and why.
    const realityPatch: Partial<BusinessRealityMap> = {};
    if (body.businessIn !== undefined) realityPatch.businessIn = asString(body.businessIn) ?? "";
    if (body.businessReallyIn !== undefined) realityPatch.businessReallyIn = asString(body.businessReallyIn) ?? "";

    const offerPatch: Partial<OfferData> = {};
    if (body.audience !== undefined) offerPatch.audience = asString(body.audience) ?? "";
    if (body.guarantees !== undefined) offerPatch.guarantee = asString(body.guarantees) ?? "";
    if (body.pricingNotes !== undefined) offerPatch.priceAnchor = asString(body.pricingNotes) ?? "";

    const messagePatch: MessagePatch = {};
    if (body.message !== undefined) {
      const m = asMessage(body.message);
      if (!m) return json({ error: "message must be an object" }, 400);
      if (m.problem !== undefined) messagePatch.internalProblem = m.problem;
      if (m.success !== undefined) messagePatch.success = m.success;
      if (m.failure !== undefined) messagePatch.failure = m.failure;
      if (m.plan !== undefined) messagePatch.plan = m.plan;
      // oneLiner is silently dropped here — never stored anywhere, always
      // computed live (see readThrough). hero/guide/callToAction have no
      // Message-tool equivalent, so they still land in `patch.message`
      // above (brand_profiles' own column) — only if at least one of them
      // was actually sent, so an all-redirected message patch never writes
      // an empty {} that would wipe brand's existing hero/guide/callToAction.
      const brandOnlyMessage: BrandMessage = {};
      if (m.hero !== undefined) brandOnlyMessage.hero = m.hero;
      if (m.guide !== undefined) brandOnlyMessage.guide = m.guide;
      if (m.callToAction !== undefined) brandOnlyMessage.callToAction = m.callToAction;
      if (Object.keys(brandOnlyMessage).length > 0) patch.message = brandOnlyMessage;
    }

    const otherJobs: Promise<unknown>[] = [];
    if (Object.keys(realityPatch).length > 0) otherJobs.push(patchReality(scope.wsId, realityPatch));
    if (Object.keys(offerPatch).length > 0) otherJobs.push(patchOffer(scope.wsId, offerPatch));
    if (Object.keys(messagePatch).length > 0) otherJobs.push(patchMessage(scope.wsId, messagePatch));

    // Promise.all, not allSettled: a partial failure across up to 4
    // Postgres targets with no shared transaction should fail loudly and
    // together, not silently commit some fields and not others.
    const [profile] = await Promise.all([upsertBrandProfile(scope.wsId, patch), Promise.all(otherJobs)]);

    const [reality, offer, message] = await Promise.all([getReality(scope.wsId), getOffer(scope.wsId), getMessage(scope.wsId)]);
    return json(readThrough(scope.wsId, profile, reality, offer, message));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
