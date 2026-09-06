/**
 * "Audit my landing page" — the pure core of the AI feature. Builds the prompt
 * that runs a Ryan Deiss / DigitalMarketer landing-page audit, and defensively
 * parses the AI's structured verdict so a malformed reply can never crash the
 * UI. The AI call itself is client-side (the user's own key, see lib/ai).
 *
 * The checklist mirrors the classic Deiss principles: the Rule of One, message
 * match, a big-idea/ultra-specific headline, name-the-pain (PAS/BAB), one CTA,
 * proof, risk reversal, value stacking, objection handling, and a lead magnet
 * for the not-ready visitor.
 */
export const DEISS_PRINCIPLES = [
  "rule_of_one",
  "headline",
  "problem_agitation",
  "single_cta",
  "social_proof",
  "risk_reversal",
  "value_stack",
  "objection_handling",
  "lead_magnet",
  "grunt_test",
] as const;
export type DeissPrinciple = (typeof DEISS_PRINCIPLES)[number];
export type FindingStatus = "strong" | "weak" | "missing";

export interface AuditFinding {
  principle: DeissPrinciple;
  status: FindingStatus;
  note: string;
  fix: string;
}
export interface LandingAudit {
  score: number; // 0..100
  summary: string;
  findings: AuditFinding[];
}

const PRINCIPLE_SET = new Set<string>(DEISS_PRINCIPLES);
const STATUS_SET = new Set<string>(["strong", "weak", "missing"]);
const MAX_TEXT = 12_000;

/** System + user messages for the audit call. `pageText` is the landing page's
 *  copy (or extracted text); it's truncated so a huge paste can't blow the
 *  token budget. */
export function buildAuditPrompt(pageText: string): { system: string; user: string } {
  const system =
    "You audit a landing page against Ryan Deiss / DigitalMarketer principles. " +
    "Score it 0-100 and evaluate each of these principles — " +
    "rule_of_one, headline, problem_agitation, single_cta, social_proof, risk_reversal, " +
    "value_stack, objection_handling, lead_magnet, grunt_test — " +
    'as "strong", "weak", or "missing". Reply with ONLY JSON: ' +
    '{"score":<0-100>,"summary":"<one sentence>","findings":[{"principle":"<one of the above>",' +
    '"status":"strong|weak|missing","note":"<what you saw>","fix":"<one concrete rewrite or action>"}]}. ' +
    "Be specific and blunt; quote the page's own words in notes. No prose outside the JSON.";
  const user = `Landing page copy:\n\n${pageText.slice(0, MAX_TEXT)}`;
  return { system, user };
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}
function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Parse the AI's reply into a validated audit, or null if unusable. Strips
 *  prose/fences, drops malformed findings, and de-dupes by principle. */
export function parseAudit(raw: string): LandingAudit | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  const rawFindings = Array.isArray(o.findings) ? o.findings : [];
  const findings: AuditFinding[] = [];
  const seen = new Set<string>();
  for (const f of rawFindings) {
    if (!f || typeof f !== "object") continue;
    const ff = f as Record<string, unknown>;
    const principle = str(ff.principle).toLowerCase();
    const status = str(ff.status).toLowerCase();
    if (!PRINCIPLE_SET.has(principle) || !STATUS_SET.has(status) || seen.has(principle)) continue;
    seen.add(principle);
    findings.push({
      principle: principle as DeissPrinciple,
      status: status as FindingStatus,
      note: str(ff.note),
      fix: str(ff.fix),
    });
  }
  if (findings.length === 0) return null;
  return { score: clampScore(o.score), summary: str(o.summary, 300), findings };
}
