/**
 * Platform export — the "authoring layer → your own stack" bridge.
 *
 * OneVYRT is where you *write* the message, funnel copy and lists; you
 * *implement* them in the tools you already run (WordPress, GoHighLevel,
 * Shopify, ActiveCampaign, Klaviyo, Mailchimp…). This module turns any piece
 * of OneVYRT copy into (a) a clean block you can copy, and (b) short, honest
 * "paste this into X" steps for each platform.
 *
 * Deliberately pure — no React, no server, no DOM — so the ExportPanel
 * component and fast unit tests both import it without pulling in a bundle.
 * The "copy + guide" layer ships first; file exports and real API pushes are
 * later phases that can reuse these same PLATFORMS + asset shapes.
 */

/** Where a piece of copy is destined, which decides the guidance we show. */
export type AssetKind =
  | "web" // headline / hero / paragraph copy for a page or funnel
  | "email" // an email subject line or body
  | "list"; // a contact list (CSV) to import as an audience

export interface ExportAsset {
  /** Stable key for React lists and copy state. */
  key: string;
  /** Human label shown above the block, e.g. "One-liner" or "Email subject". */
  label: string;
  kind: AssetKind;
  /** The actual text to copy. Empty-string assets are filtered out by callers. */
  value: string;
}

export interface Platform {
  id: string;
  name: string;
  /** One-line orientation shown under the platform's name. */
  note: string;
}

/** The platforms OneVYRT users most often implement in. Order = display order. */
export const PLATFORMS: readonly Platform[] = [
  { id: "wordpress", name: "WordPress", note: "Pages, posts & most page builders (Elementor, Divi…)." },
  { id: "gohighlevel", name: "GoHighLevel", note: "Funnels, websites, emails & SMS." },
  { id: "shopify", name: "Shopify", note: "Store pages, product copy & email." },
  { id: "activecampaign", name: "ActiveCampaign", note: "Email campaigns & automations." },
  { id: "klaviyo", name: "Klaviyo", note: "Email & SMS flows." },
  { id: "mailchimp", name: "Mailchimp", note: "Email campaigns & audiences." },
] as const;

export function platformById(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/**
 * Short, honest, do-this-now steps for putting a given kind of copy into a
 * given platform. No screenshots, no fluff — the two or three clicks that
 * actually matter, ending on "paste". Returns a generic fallback for any
 * platform id we don't have bespoke steps for, so new PLATFORMS never break.
 */
export function platformGuide(platformId: string, kind: AssetKind): string[] {
  const g = GUIDES[platformId]?.[kind];
  if (g) return g;
  // Generic, still-useful fallback keyed only on the kind.
  switch (kind) {
    case "web":
      return ["Open the page or funnel step you're editing.", "Add or select a text block.", "Paste the copied text and save."];
    case "email":
      return ["Open your email builder and start a campaign.", "Click into the subject line or body.", "Paste the copied text, then send a test to yourself."];
    case "list":
      return ["Open your Contacts or Audience area.", "Choose Import and upload the CSV.", "Map the Email/Name columns, then confirm the import."];
  }
}

/**
 * Per-platform steps. Kept as data (not code) so it's trivial to review, extend
 * and unit-test. Every platform provides all three kinds; missing entries fall
 * back to the generic guide above.
 */
const GUIDES: Record<string, Partial<Record<AssetKind, string[]>>> = {
  wordpress: {
    web: [
      "Edit the page in WordPress (Gutenberg or your page builder).",
      "Add a Paragraph or Heading block where the copy should go.",
      "Paste the text and Update the page.",
    ],
    email: [
      "In your email plugin (Newsletter, MailPoet, FluentCRM…), start a new email.",
      "Click the subject or body area.",
      "Paste the copied text and save the draft.",
    ],
    list: [
      "Open your email plugin's Subscribers/Lists screen.",
      "Choose Import and upload the CSV.",
      "Map the Email and Name columns, then run the import.",
    ],
  },
  gohighlevel: {
    web: [
      "Open Sites → your Funnel or Website and edit the step.",
      "Drop in (or select) a Text element.",
      "Paste the copy and Save.",
    ],
    email: [
      "Go to Marketing → Emails (or a workflow Email action).",
      "Click the subject line or the email body.",
      "Paste the text, then send a test.",
    ],
    list: [
      "Open Contacts and click Import Contacts.",
      "Upload the CSV and map Email/Name.",
      "Add a tag on import so you can target this audience.",
    ],
  },
  shopify: {
    web: [
      "In admin, open Online Store → Pages (or edit a product).",
      "Click into the content editor.",
      "Paste the copy and Save.",
    ],
    email: [
      "Open Marketing → Create campaign → Shopify Email.",
      "Click the subject line or a text section.",
      "Paste the text and preview it.",
    ],
    list: [
      "Go to Customers → Import customers by CSV.",
      "Upload the file and match Email/Name columns.",
      "Import, then build a segment from the new customers.",
    ],
  },
  activecampaign: {
    web: [
      "ActiveCampaign is for email/automation — use this copy on your site or landing pages.",
      "If you use AC Pages, edit the page and add a text block.",
      "Paste the copy and save.",
    ],
    email: [
      "Open Campaigns → Create a campaign and pick a template.",
      "Set the Subject field, then click into the body.",
      "Paste the text and send yourself a test.",
    ],
    list: [
      "Go to Contacts → Import.",
      "Upload the CSV and map Email/Name fields.",
      "Assign it to a list or tag during import.",
    ],
  },
  klaviyo: {
    web: [
      "Klaviyo is email/SMS — use this copy on your storefront or landing page.",
      "For Klaviyo forms, edit the form and select a text block.",
      "Paste the copy and save.",
    ],
    email: [
      "Open Campaigns → Create Campaign → Email.",
      "Fill the Subject line, then edit the content.",
      "Paste the body text and preview.",
    ],
    list: [
      "Go to Audience → Lists & Segments → Create List.",
      "Choose Upload contacts and select the CSV.",
      "Map Email/Name, then finish the upload.",
    ],
  },
  mailchimp: {
    web: [
      "Mailchimp is email-first — use this copy on your site or a Mailchimp landing page.",
      "For a landing page, edit it and add a text content block.",
      "Paste the copy and save.",
    ],
    email: [
      "Create → Email → Regular, and pick your audience.",
      "Set the Subject, then edit the design.",
      "Paste the body into a text block and preview.",
    ],
    list: [
      "Open Audience → All contacts → Import contacts.",
      "Upload the CSV and match Email/Name columns.",
      "Tag them on import so you can target this group.",
    ],
  },
};

/**
 * Build the copy-ready asset list for a StoryBrand message. Returns only the
 * blocks that actually have content, each as a "web" asset (page/funnel copy).
 * Callers append email/list assets from their own surfaces.
 */
export function messageAssets(input: {
  oneLiner?: string;
  wants?: string;
  success?: string;
  plan?: string;
}): ExportAsset[] {
  const out: ExportAsset[] = [];
  const push = (key: string, label: string, value: string | undefined) => {
    const v = (value ?? "").trim();
    if (v) out.push({ key, label, kind: "web", value: v });
  };
  push("oneLiner", "One-liner (hero headline)", input.oneLiner);
  push("wants", "What your customer wants (sub-headline)", input.wants);
  push("success", "Success / promise (CTA support)", input.success);
  push("plan", "Your plan (3-step section)", input.plan);
  return out;
}

// — Offer → sales-page copy —

export interface OfferExportInput {
  name?: string;
  promise?: string;
  deliverables?: string[];
  price?: string;
  priceAnchor?: string;
  guarantee?: string;
  objections?: { q: string; a: string }[];
  /** Pre-composed positioning statement (from offer-coach.composePositioning). */
  positioning?: string;
}

/** Assemble the whole offer into one paste-ready sales-page block, sections
 *  omitted when empty. Plain text with light structure so it drops cleanly into
 *  any page builder or email. */
export function composeSalesPage(o: OfferExportInput): string {
  const t = (s: string | undefined) => (s ?? "").trim();
  const blocks: string[] = [];
  const headline = t(o.name) || t(o.promise);
  if (headline) blocks.push(headline);
  if (t(o.positioning)) blocks.push(t(o.positioning));
  else if (t(o.promise) && t(o.promise) !== headline) blocks.push(t(o.promise));
  const delivs = (o.deliverables ?? []).map((d) => t(d)).filter(Boolean);
  if (delivs.length) blocks.push(["What's included:", ...delivs.map((d) => `• ${d}`)].join("\n"));
  const priceBits = [t(o.price), t(o.priceAnchor) && `(${t(o.priceAnchor)})`].filter(Boolean).join(" ");
  if (priceBits) blocks.push(`Investment: ${priceBits}`);
  if (t(o.guarantee)) blocks.push(`Our guarantee: ${t(o.guarantee)}`);
  const faqs = (o.objections ?? []).filter((x) => t(x?.q) && t(x?.a));
  if (faqs.length) blocks.push(["FAQ:", ...faqs.map((x) => `Q: ${t(x.q)}\nA: ${t(x.a)}`)].join("\n\n"));
  return blocks.join("\n\n");
}

/**
 * Turn the offer into export blocks: each section as its own copyable "web"
 * asset, plus one assembled "Full sales page". Empty sections are dropped by
 * the caller (ExportPanel filters empties), so this can push freely.
 */
export function offerAssets(o: OfferExportInput): ExportAsset[] {
  const out: ExportAsset[] = [];
  const t = (s: string | undefined) => (s ?? "").trim();
  const push = (key: string, label: string, value: string) => { if (value.trim()) out.push({ key, label, kind: "web", value }); };

  push("hero", "Hero headline", t(o.name) || t(o.promise));
  push("positioning", "Positioning statement", t(o.positioning));
  push("promise", "The promise (sub-headline)", t(o.promise));
  const delivs = (o.deliverables ?? []).map((d) => t(d)).filter(Boolean);
  push("deliverables", "What's included", delivs.map((d) => `• ${d}`).join("\n"));
  const priceBits = [t(o.price), t(o.priceAnchor) && `(${t(o.priceAnchor)})`].filter(Boolean).join(" ");
  push("price", "Price & framing", priceBits);
  push("guarantee", "Guarantee", t(o.guarantee));
  const faqs = (o.objections ?? []).filter((x) => t(x?.q) && t(x?.a));
  push("objections", "Objections (FAQ)", faqs.map((x) => `Q: ${t(x.q)}\nA: ${t(x.a)}`).join("\n\n"));
  push("salespage", "Full sales page", composeSalesPage(o));
  return out;
}

/** The minimal shape of a saved Golden Example needed to export it as copy
 *  blocks. Kept local so this module has no dependency on golden-example.ts. */
export interface GoldenExportInput {
  insight?: string;
  ladder?: { stage?: string; name?: string; price?: string; role?: string }[];
  usp?: string;
  salesAngle?: string;
  ad?: string;
}

/**
 * Copy blocks from the saved Golden Example — the value-ladder strategy, USP,
 * sales-page angle and ad — so the founder's overall strategy ships alongside
 * the offer and message in the Sales Kit. Returns [] when there's no ladder.
 */
export function goldenAssets(g: GoldenExportInput | null | undefined): ExportAsset[] {
  if (!g) return [];
  const out: ExportAsset[] = [];
  const t = (s: string | undefined) => (s ?? "").trim();
  const push = (key: string, label: string, value: string) => { if (value.trim()) out.push({ key, label, kind: "web", value }); };

  const rungs = (g.ladder ?? []).filter((r) => t(r?.name) || t(r?.stage));
  if (rungs.length === 0) return [];

  push("g-usp", "USP (one line)", t(g.usp));
  const ladderText = rungs
    .map((r, i) => {
      const head = [t(r.stage) || `Rung ${i + 1}`, t(r.price) && `— ${t(r.price)}`].filter(Boolean).join(" ");
      const body = [t(r.name), t(r.role) && `(${t(r.role)})`].filter(Boolean).join(" ");
      return `${i + 1}. ${head}${body ? `: ${body}` : ""}`;
    })
    .join("\n");
  const ladderBlock = [t(g.insight) && `Strategy: ${t(g.insight)}`, "", ladderText].filter((l) => l !== undefined).join("\n").trim();
  push("g-ladder", "Value ladder (your strategy)", ladderBlock);
  push("g-sales-angle", "Sales-page angle", t(g.salesAngle));
  push("g-ad", "Ad", t(g.ad));
  return out;
}
