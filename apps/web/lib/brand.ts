/**
 * Campaign Studio foundation, part 2: the "Brand Brain" — one persistent
 * brand profile per workspace. Every future generator (ad creative, landing
 * page copy, email) should read from here instead of asking the user to
 * re-explain their company each time. One row per workspace, upserted.
 */
import { pgPool, withAdvisoryLock, type Queryable } from "./db";

export interface BrandProduct { name: string; description?: string; price?: string; }
export interface BrandTestimonial { quote: string; author?: string; }

/**
 * The brand's core message, structured on the well-known seven-part story
 * framework (customer-as-hero, their problem, brand-as-guide, a plan, a call
 * to action, the failure they avoid, the success they reach) plus a one-line
 * summary. Original field set inspired by that framework's structure — the
 * downstream ad/landing/email generators read this so every message keeps the
 * customer the hero and the brand the guide.
 */
export interface BrandMessage {
  hero?: string;        // who the customer is + what they want
  problem?: string;     // the problem stopping them (external/internal)
  guide?: string;       // how the brand shows empathy + authority
  plan?: string;        // the simple steps to work with the brand
  callToAction?: string;// the direct ask
  success?: string;     // what winning looks like
  failure?: string;     // the stakes / what they avoid
  oneLiner?: string;    // the whole thing in one sentence
}

export interface BrandProfile {
  workspaceId: string;
  websiteUrl?: string;
  companyName?: string;
  industry?: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  primaryColorName?: string;
  secondaryColor?: string;
  secondaryColorName?: string;
  businessIn?: string;
  businessReallyIn?: string;
  language?: string;
  brandVoice?: string;
  message?: BrandMessage;
  prohibitedWords: string[];
  products: BrandProduct[];
  audience?: string;
  competitors?: string;
  guarantees?: string;
  pricingNotes?: string;
  locations?: string;
  testimonials: BrandTestimonial[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfilePatch {
  websiteUrl?: string; companyName?: string; industry?: string; description?: string; logoUrl?: string;
  primaryColor?: string; primaryColorName?: string; secondaryColor?: string; secondaryColorName?: string;
  businessIn?: string; businessReallyIn?: string;
  language?: string; brandVoice?: string; message?: BrandMessage; prohibitedWords?: string[]; products?: BrandProduct[];
  audience?: string; competitors?: string; guarantees?: string; pricingNotes?: string; locations?: string;
  testimonials?: BrandTestimonial[];
}

const MAX_TEXT = 20_000;
// The logo can be an uploaded image stored as a data: URL (see the Brand
// Brain page's client-side resize), so it needs a much larger cap than the
// short text fields — same order of magnitude as the avatar limit in
// lib/auth.ts. The page resizes to ~256px before upload, so this is headroom.
export const MAX_LOGO = 400_000;

interface BrandProfileRow {
  workspace_id: string; website_url: string | null; company_name: string | null; industry: string | null;
  description: string | null; logo_url: string | null; primary_color: string | null; primary_color_name: string | null;
  secondary_color: string | null; secondary_color_name: string | null; business_in: string | null; business_really_in: string | null;
  language: string | null; brand_voice: string | null; prohibited_words: string[]; products: BrandProduct[];
  audience: string | null; competitors: string | null; guarantees: string | null; pricing_notes: string | null;
  locations: string | null; testimonials: BrandTestimonial[]; message: BrandMessage | null; created_at: Date; updated_at: Date;
}

function rowToBrandProfile(row: BrandProfileRow): BrandProfile {
  return {
    workspaceId: row.workspace_id,
    ...(row.website_url ? { websiteUrl: row.website_url } : {}),
    ...(row.company_name ? { companyName: row.company_name } : {}),
    ...(row.industry ? { industry: row.industry } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.logo_url ? { logoUrl: row.logo_url } : {}),
    ...(row.primary_color ? { primaryColor: row.primary_color } : {}),
    ...(row.primary_color_name ? { primaryColorName: row.primary_color_name } : {}),
    ...(row.secondary_color ? { secondaryColor: row.secondary_color } : {}),
    ...(row.secondary_color_name ? { secondaryColorName: row.secondary_color_name } : {}),
    ...(row.business_in ? { businessIn: row.business_in } : {}),
    ...(row.business_really_in ? { businessReallyIn: row.business_really_in } : {}),
    ...(row.language ? { language: row.language } : {}),
    ...(row.brand_voice ? { brandVoice: row.brand_voice } : {}),
    ...(row.message && Object.keys(row.message).length ? { message: row.message } : {}),
    prohibitedWords: row.prohibited_words ?? [],
    products: row.products ?? [],
    ...(row.audience ? { audience: row.audience } : {}),
    ...(row.competitors ? { competitors: row.competitors } : {}),
    ...(row.guarantees ? { guarantees: row.guarantees } : {}),
    ...(row.pricing_notes ? { pricingNotes: row.pricing_notes } : {}),
    ...(row.locations ? { locations: row.locations } : {}),
    testimonials: row.testimonials ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const BRAND_COLUMNS = "workspace_id, website_url, company_name, industry, description, logo_url, primary_color, primary_color_name, secondary_color, secondary_color_name, business_in, business_really_in, language, brand_voice, message, prohibited_words, products, audience, competitors, guarantees, pricing_notes, locations, testimonials, created_at, updated_at";

export async function getBrandProfile(workspaceId: string, db: Queryable = pgPool()): Promise<BrandProfile | null> {
  const res = await db.query<BrandProfileRow>(`SELECT ${BRAND_COLUMNS} FROM brand_profiles WHERE workspace_id = $1`, [workspaceId]);
  return res.rows[0] ? rowToBrandProfile(res.rows[0]) : null;
}

// Per-workspace lock so a partial save's read-merge-write can't be clobbered by
// a concurrent save (double-submit, or a multi-step wizard). Read and write run
// on the SAME locked client — never wrap this at the route level, which would
// hold the lock connection while these inner calls check out a second one.
const brandLockKey = (workspaceId: string) => `brand:${workspaceId}`;

/** Creates the profile on first save, updates it after — one row per
 *  workspace. Fields not present in `patch` keep their existing value
 *  (a partial save from a multi-step brand-setup wizard shouldn't blank out
 *  fields entered in an earlier step). */
export async function upsertBrandProfile(workspaceId: string, patch: BrandProfilePatch): Promise<BrandProfile> {
  return withAdvisoryLock(brandLockKey(workspaceId), async (db) => {
  const existing = await getBrandProfile(workspaceId, db);
  const clip = (s: string, max = MAX_TEXT) => s.trim().slice(0, max);
  const pick = (v: string | undefined, prev: string | undefined, max = MAX_TEXT) => (v !== undefined ? (clip(v, max) || undefined) : prev);

  const merged = {
    websiteUrl: pick(patch.websiteUrl, existing?.websiteUrl),
    companyName: pick(patch.companyName, existing?.companyName),
    industry: pick(patch.industry, existing?.industry),
    description: pick(patch.description, existing?.description),
    logoUrl: pick(patch.logoUrl, existing?.logoUrl, MAX_LOGO),
    primaryColor: pick(patch.primaryColor, existing?.primaryColor),
    primaryColorName: pick(patch.primaryColorName, existing?.primaryColorName),
    secondaryColor: pick(patch.secondaryColor, existing?.secondaryColor),
    secondaryColorName: pick(patch.secondaryColorName, existing?.secondaryColorName),
    businessIn: pick(patch.businessIn, existing?.businessIn),
    businessReallyIn: pick(patch.businessReallyIn, existing?.businessReallyIn),
    language: pick(patch.language, existing?.language),
    brandVoice: pick(patch.brandVoice, existing?.brandVoice),
    message: patch.message !== undefined ? patch.message : existing?.message,
    prohibitedWords: patch.prohibitedWords !== undefined ? patch.prohibitedWords.map((w) => clip(w)).filter(Boolean) : (existing?.prohibitedWords ?? []),
    products: patch.products !== undefined ? patch.products : (existing?.products ?? []),
    audience: pick(patch.audience, existing?.audience),
    competitors: pick(patch.competitors, existing?.competitors),
    guarantees: pick(patch.guarantees, existing?.guarantees),
    pricingNotes: pick(patch.pricingNotes, existing?.pricingNotes),
    locations: pick(patch.locations, existing?.locations),
    testimonials: patch.testimonials !== undefined ? patch.testimonials : (existing?.testimonials ?? []),
  };
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO brand_profiles (
       workspace_id, website_url, company_name, industry, description, logo_url, primary_color, primary_color_name,
       secondary_color, secondary_color_name, business_in, business_really_in, language, brand_voice, prohibited_words,
       products, audience, competitors, guarantees, pricing_notes, locations, testimonials, message, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24)
     ON CONFLICT (workspace_id) DO UPDATE SET
       website_url = $2, company_name = $3, industry = $4, description = $5, logo_url = $6,
       primary_color = $7, primary_color_name = $8, secondary_color = $9, secondary_color_name = $10,
       business_in = $11, business_really_in = $12, language = $13, brand_voice = $14, prohibited_words = $15,
       products = $16, audience = $17, competitors = $18, guarantees = $19, pricing_notes = $20,
       locations = $21, testimonials = $22, message = $23, updated_at = $24`,
    [
      workspaceId, merged.websiteUrl ?? null, merged.companyName ?? null, merged.industry ?? null,
      merged.description ?? null, merged.logoUrl ?? null, merged.primaryColor ?? null, merged.primaryColorName ?? null,
      merged.secondaryColor ?? null, merged.secondaryColorName ?? null, merged.businessIn ?? null, merged.businessReallyIn ?? null,
      merged.language ?? null, merged.brandVoice ?? null, merged.prohibitedWords, JSON.stringify(merged.products),
      merged.audience ?? null, merged.competitors ?? null, merged.guarantees ?? null, merged.pricingNotes ?? null,
      merged.locations ?? null, JSON.stringify(merged.testimonials), JSON.stringify(merged.message ?? {}), now,
    ],
  );
  return { workspaceId, ...merged, createdAt: existing?.createdAt ?? now, updatedAt: now };
  });
}
