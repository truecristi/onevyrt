"use client";
/**
 * The shared "Brand Brain brief" every AI generator conditions on — so campaign
 * copy, ad creative, funnel intros and questions all speak in the workspace's
 * real brand voice and facts instead of generic copy. One source of truth
 * rather than a per-page copy of the shape + formatter.
 *
 * Best-effort by design: a workspace with no Brand Brain (or no Campaign Studio
 * entitlement) yields null, and callers simply skip the brand block.
 */

export interface BrandMessage { hero?: string; problem?: string; guide?: string; plan?: string; callToAction?: string; success?: string; oneLiner?: string; }
export interface BrandProfile {
  companyName?: string; industry?: string; description?: string; brandVoice?: string;
  audience?: string; language?: string; businessReallyIn?: string; guarantees?: string;
  message?: BrandMessage; products?: { name: string; description?: string; price?: string }[];
  testimonials?: { quote: string; author?: string }[]; prohibitedWords?: string[];
}

/** A compact brand brief the AI can condition on. Kept short to save tokens. */
export function brandBrief(b: BrandProfile | null | undefined): string {
  if (!b) return "(no brand profile yet)";
  const lines: string[] = [];
  if (b.companyName) lines.push(`Brand: ${b.companyName}`);
  if (b.industry) lines.push(`Industry: ${b.industry}`);
  if (b.businessReallyIn) lines.push(`Really in the business of: ${b.businessReallyIn}`);
  if (b.description) lines.push(`About: ${b.description}`);
  if (b.audience) lines.push(`Audience: ${b.audience}`);
  if (b.brandVoice) lines.push(`Voice: ${b.brandVoice}`);
  if (b.message?.oneLiner) lines.push(`One-liner: ${b.message.oneLiner}`);
  if (b.message?.problem) lines.push(`Customer problem: ${b.message.problem}`);
  if (b.message?.success) lines.push(`Success looks like: ${b.message.success}`);
  if (b.guarantees) lines.push(`Guarantee: ${b.guarantees}`);
  if (b.products?.length) lines.push(`Products: ${b.products.slice(0, 6).map((p) => p.name).join(", ")}`);
  if (b.language) lines.push(`Write in: ${b.language}`);
  if (b.prohibitedWords?.length) lines.push(`Never use these words: ${b.prohibitedWords.join(", ")}`);
  return lines.join("\n") || "(brand profile is mostly empty)";
}

/** True when the profile carries at least something worth conditioning on. */
export function hasBrand(b: BrandProfile | null | undefined): boolean {
  return !!(b && (b.companyName || b.description || b.brandVoice || b.audience || b.message?.oneLiner));
}

/**
 * Best-effort fetch of the saved Brand Brain. Returns null on no profile, no
 * Campaign Studio entitlement (403), not signed in (401), or any network error,
 * so a caller can always `?? null` and skip the brand block.
 */
export async function loadBrandProfile(): Promise<BrandProfile | null> {
  try {
    const r = await fetch("/api/campaign-studio/brand", { credentials: "include" });
    if (!r.ok) return null;
    return (await r.json()) as BrandProfile;
  } catch {
    return null;
  }
}
