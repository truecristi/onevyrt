/**
 * The "learn" step of the flywheel, made legible. Turns a workspace's real
 * acquisition metrics into a prompt for the owner's own connected AI, and parses
 * the reply into a structured weekly digest: a headline read, a short summary,
 * and a few concrete insights each with a recommended action. Pure functions —
 * no network, no AI keys (generation happens client-side via lib/ai/client).
 */
/** Pull the first JSON object out of a model reply, tolerating ```json fences
 *  and surrounding prose. Returns null if none parses. */
function extractJson(raw: string): unknown {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], raw];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try { return JSON.parse(c.slice(start, end + 1)); } catch { /* try next */ }
  }
  return null;
}

export interface InsightsSnapshot {
  currency: string;
  overview: {
    leadsTotal: number; leads7d: number; qualified: number; qualifyRate: number;
    bookingsTotal: number; bookRate: number; upcoming: number;
  };
  economics: { spend: number; costPerQualified: number; costPerBooking: number };
  funnels: { slug: string; title: string; leads: number; qualified: number; booked: number; qualifyRate: number; costPerQualified: number }[];
  angles: { angle: string; qualified: number; leads: number; qualifyRate: number; costPerQualified: number }[];
  creatives: { headline: string; angle: string | null; qualified: number; leads: number; costPerQualified: number }[];
}

export interface Insight { title: string; detail: string; action: string }
export interface InsightsDigest { headline: string; summary: string; insights: Insight[] }

/** True when there's essentially nothing to analyse yet. */
export function isSnapshotEmpty(s: InsightsSnapshot): boolean {
  return s.overview.leadsTotal === 0 && s.funnels.length === 0;
}

/** Build the {system, user} prompt from a metrics snapshot. */
export function insightsPrompt(s: InsightsSnapshot): { system: string; user: string } {
  const system = [
    "You are a growth analyst for a solo business owner using an acquisition funnel tool.",
    "You are given this week's real numbers. Write a short, plain-English read of what's working and what to fix.",
    "Be specific and quantitative — cite the actual numbers. No fluff, no generic marketing advice.",
    "Every insight must be grounded in the data provided; never invent numbers.",
    "Prefer the highest-leverage moves: the angle or funnel that converts best (do more of it), and the biggest leak (fix it).",
    "Respond with ONLY a JSON object, no prose around it, in this exact shape:",
    '{"headline": string, "summary": string, "insights": [{"title": string, "detail": string, "action": string}]}',
    "headline: one punchy sentence. summary: 1-2 sentences. insights: 3 to 5 items, each with a concrete, doable action.",
  ].join("\n");

  const user = [
    "This workspace's acquisition metrics (currency " + s.currency + "):",
    "",
    "OVERVIEW",
    `- Leads all-time: ${s.overview.leadsTotal} (last 7 days: ${s.overview.leads7d})`,
    `- Qualified: ${s.overview.qualified} (${pct(s.overview.qualifyRate)} of leads qualify)`,
    `- Booked calls: ${s.overview.bookingsTotal} (${pct(s.overview.bookRate)} of qualified book), ${s.overview.upcoming} upcoming`,
    "",
    "ECONOMICS",
    `- Ad spend entered: ${money(s.economics.spend, s.currency)}`,
    `- Cost per qualified lead: ${s.economics.costPerQualified > 0 ? money(s.economics.costPerQualified, s.currency) : "n/a (no spend or no qualified yet)"}`,
    `- Cost per booked call: ${s.economics.costPerBooking > 0 ? money(s.economics.costPerBooking, s.currency) : "n/a"}`,
    "",
    "FUNNELS (each qualification funnel)",
    ...(s.funnels.length ? s.funnels.map((f) => `- "${f.title}" (/q/${f.slug}): ${f.leads} leads, ${f.qualified} qualified (${pct(f.qualifyRate)}), ${f.booked} booked${f.costPerQualified > 0 ? `, ${money(f.costPerQualified, s.currency)}/qualified` : ""}`) : ["- (no funnels with traffic yet)"]),
    "",
    "ANGLES (creative angles, rolled up across ads)",
    ...(s.angles.length ? s.angles.map((a) => `- "${a.angle}": ${a.leads} leads, ${a.qualified} qualified (${pct(a.qualifyRate)})${a.costPerQualified > 0 ? `, ${money(a.costPerQualified, s.currency)}/qualified` : ""}`) : ["- (no tracked creatives yet)"]),
    "",
    "TOP CREATIVES",
    ...(s.creatives.length ? s.creatives.map((c) => `- "${c.headline}"${c.angle ? ` [${c.angle}]` : ""}: ${c.leads} leads, ${c.qualified} qualified`) : ["- (none tracked yet)"]),
    "",
    "Write the digest as specified. Ground every claim in these numbers.",
  ].join("\n");

  return { system, user };
}

/** Parse the AI reply into a digest. Throws if it can't find usable JSON. */
export function parseInsights(reply: string): InsightsDigest {
  const parsed = extractJson(reply) as Partial<InsightsDigest> | null;
  if (!parsed || typeof parsed !== "object") throw new Error("The model didn't return a usable digest.");
  const insights: Insight[] = Array.isArray(parsed.insights)
    ? parsed.insights
        .filter((i): i is Insight => !!i && typeof (i as Insight).title === "string")
        .map((i) => ({ title: String(i.title).trim(), detail: String(i.detail ?? "").trim(), action: String(i.action ?? "").trim() }))
        .filter((i) => i.title)
    : [];
  if (insights.length === 0) throw new Error("The model's digest had no insights — try again.");
  return {
    headline: typeof parsed.headline === "string" ? parsed.headline.trim() : "This week's read",
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    insights: insights.slice(0, 6),
  };
}

function pct(x: number): string { return `${Math.round((x || 0) * 100)}%`; }
function money(n: number, ccy: string): string {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(n); }
  catch { return `${ccy} ${Math.round(n)}`; }
}
