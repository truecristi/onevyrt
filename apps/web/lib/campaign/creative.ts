/**
 * Creative Loop — the front of the acquisition flywheel. Turns a brief into a
 * set of Meta ad creative variants, each from a genuinely different persuasion
 * angle, self-scored and ranked so the owner knows which to run first. Pure and
 * deterministic (prompt-building + parsing only) so it's unit-testable; the
 * actual generation is a client-side BYO-AI call in the page. Each variant
 * carries a creative_id, and creativeLink() points it at a qualification funnel
 * with the right UTM/creative params — so when it drives a lead, the Leads
 * Inbox attributes back to this exact creative and the loop closes.
 */
export interface CreativeVariant {
  angle: string;
  headline: string;
  primaryText: string;
  cta: string;
  /** self-assessed 0..100 scroll-stopping / qualified-click potential */
  score: number;
  why: string;
  /** stable id used as creative_id in the funnel link + attribution */
  creativeId: string;
}

const ANGLES = "genuinely different persuasion angles — e.g. cost-of-inaction/pain, aspiration/transformation, social proof, urgency/scarcity, authority/credibility, contrarian pattern-interrupt — each a distinct way in, never a reword of another";

/** Build the system + user prompt for a run of `count` creative variants.
 *  `winningAngles` (from real performance) biases generation toward what's
 *  actually converted — the learning loop that makes each round compound. */
export function creativePrompt(brief: string, count: number, winningAngles: string[] = [], brand = "", strategy = ""): { system: string; user: string } {
  const n = Math.max(1, Math.min(10, count));
  const winners = winningAngles.map((a) => a.trim()).filter(Boolean).slice(0, 5);
  const focus = winners.length
    ? ` These angles have converted best for this business so far: ${winners.join(", ")}. ` +
      `Lean into what makes them work — most variants should be fresh takes on these winners, ` +
      `plus 1-2 genuinely new angles to keep testing.`
    : "";
  const brandNote = brand.trim()
    ? ` Write in the BRAND's voice and use its real facts — never contradict or invent past them.`
    : "";
  const strategyNote = strategy.trim()
    ? ` Aim the creative at the BUSINESS STRATEGY — its goal, gaps and current growth constraint.`
    : "";
  const system =
    `You are a direct-response ad strategist writing Meta/Facebook ad creative. ` +
    `Produce ${n} variants for the brief, each from one of ${ANGLES}.${focus}${brandNote}${strategyNote} ` +
    `For each variant write: a scroll-stopping headline (max ~8 words), primary text ` +
    `(2-4 short concrete sentences, no hype clichés), and a CTA (max ~4 words). ` +
    `Then score each 0-100 for how likely it is to stop the scroll and earn a qualified click, ` +
    `and give a one-line reason. Return ONLY compact JSON, no prose: ` +
    `{"variants":[{"angle":"","headline":"","primaryText":"","cta":"","score":0,"why":""}]}.`;
  const user =
    (brand.trim() ? `BRAND:\n${brand.trim().slice(0, 1500)}\n\n` : "") +
    (strategy.trim() ? `BUSINESS STRATEGY:\n${strategy.trim().slice(0, 1200)}\n\n` : "") +
    `Brief:\n${brief.trim().slice(0, 2000)}`;
  return { system, user };
}

/** Slugify an angle/headline into a URL- and attribution-safe id. */
export function slugifyCreative(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "creative";
}

/** Pull the first JSON object/array out of a model reply (handles ``` fences
 *  and surrounding prose). Returns null when nothing parses. */
function extractJson(raw: string): unknown {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : raw;
  const start = body.search(/[[{]/);
  if (start === -1) return null;
  // Try progressively shorter suffixes from the last closing bracket.
  for (let end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]")); end > start; end--) {
    if (body[end] !== "}" && body[end] !== "]") continue;
    try { return JSON.parse(body.slice(start, end + 1)); } catch { /* keep shrinking */ }
  }
  return null;
}

/** Parse + sanitise + rank a model reply into creative variants. Drops entries
 *  without a headline; clamps scores; assigns unique creative ids; sorts best
 *  first. */
export function parseCreatives(reply: string): CreativeVariant[] {
  const j = extractJson(reply);
  const arr: unknown[] = j && typeof j === "object" && Array.isArray((j as { variants?: unknown[] }).variants)
    ? (j as { variants: unknown[] }).variants
    : Array.isArray(j) ? j : [];
  const out: CreativeVariant[] = [];
  for (const raw of arr) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const headline = String(r.headline ?? "").trim().slice(0, 140);
    if (!headline) continue;
    const angle = String(r.angle ?? "").trim().slice(0, 60) || "Angle";
    const score = Math.max(0, Math.min(100, Math.round(Number(r.score)) || 0));
    out.push({
      angle,
      headline,
      primaryText: String(r.primaryText ?? r.primary_text ?? "").trim().slice(0, 700),
      cta: String(r.cta ?? "").trim().slice(0, 40) || "Learn more",
      score,
      why: String(r.why ?? "").trim().slice(0, 240),
      creativeId: slugifyCreative(angle),
    });
  }
  // Ensure creative ids are unique (angles can collide).
  const seen = new Set<string>();
  for (const v of out) {
    let id = v.creativeId, n = 1;
    while (seen.has(id)) id = `${v.creativeId}-${++n}`;
    seen.add(id);
    v.creativeId = id;
  }
  return out.sort((a, b) => b.score - a.score);
}

/** The funnel URL a creative should point at, carrying the attribution params
 *  the funnel captures — so a lead from this creative is traced back to it. */
export function creativeLink(funnelSlug: string, v: CreativeVariant, source = "meta"): string {
  const q = new URLSearchParams({
    utm_source: source,
    utm_medium: "paid",
    utm_campaign: slugifyCreative(v.angle),
    creative_id: v.creativeId,
  });
  return `/q/${funnelSlug}?${q.toString()}`;
}
