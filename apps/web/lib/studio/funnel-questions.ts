/**
 * AI-drafted qualification questions from the saved Message (task #35).
 *
 * The "one voice" spine reaches the funnel's *questions*: instead of a blank
 * "New question", the builder can draft a short, scored qualification set from
 * the StoryBrand message the owner already wrote — who the customer is, what
 * they want, the plan, and what failure they're avoiding all become the raw
 * material for good gating questions.
 *
 * Pure and server-free (no React, no fetch): the prompt builder and the
 * response parser live here so the funnel builder client and fast unit tests
 * both import them without bundling anything. The actual AI call stays in the
 * page, using the existing callAI(conn, system, user) pattern.
 */
import type { BuilderQuestion, BuilderQuestionKind, BuilderOption } from "./funnel-builder";
import { composeOneLiner } from "./message-copy";
import type { MessageInput } from "./message-copy";

/** Sane ceilings so a chatty model can't produce an unusable wall of inputs. */
const MAX_QUESTIONS = 6;
const MAX_OPTIONS = 5;
const KINDS: readonly BuilderQuestionKind[] = ["single", "multi", "number", "text"];

export const QUESTIONS_SYSTEM =
  "You design short lead-qualification funnels. From a business's message, write 3–5 crisp questions that sort serious buyers from browsers. " +
  "Prefer single-choice questions with 2–4 options; give each option a points value 0–10 (higher = more qualified), and set disqualify:true on an option that means an instant no-fit (e.g. no budget, wrong role). " +
  "Use plain language, one sentence per question, no jargon. " +
  'Respond with ONLY minified JSON, no preamble or code fences, in exactly this shape: {"questions":[{"prompt":"","kind":"single","options":[{"label":"","points":0,"disqualify":false}]}]}. ' +
  'For "number" or "text" questions omit options.';

/** Compose the grounding context the model drafts from. Empty parts are dropped. */
export function buildQuestionsPrompt(m: MessageInput | null | undefined, funnelTitle?: string, strategy = "", brand = ""): string {
  const ol = composeOneLiner(m?.oneLiner);
  const lines = [
    brand.trim() && `BRAND (write in this voice):\n${brand.trim()}`,
    strategy.trim() && `BUSINESS STRATEGY (qualify for the goal and constraint below):\n${strategy.trim()}`,
    funnelTitle && `Funnel: ${funnelTitle}`,
    ol && `Business one-liner: ${ol}`,
    m?.character && `Customer (the hero): ${m.character}`,
    m?.wants && `What they want: ${m.wants}`,
    m?.internalProblem && `How the problem feels: ${m.internalProblem}`,
    m?.plan && `Our plan: ${m.plan}`,
    m?.success && `Success looks like: ${m.success}`,
    m?.failure && `Failure they avoid: ${m.failure}`,
  ].filter(Boolean);
  const ctx = lines.length ? lines.join("\n") : "A general small-business lead qualification funnel.";
  return `${ctx}\n\nWrite the qualification questions now.`;
}

/** Strip markdown code fences so JSON.parse has a clean shot at the payload. */
function stripFences(reply: string): string {
  const s = reply.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1]!.trim() : s;
}

/** Slice to the outermost JSON value — array OR object — tolerating prose on
 *  either side. Bracket-aware so a bare `[…]` array survives intact. */
function sliceOutermost(s: string): string {
  const starts = [s.indexOf("{"), s.indexOf("[")].filter((i) => i >= 0);
  const ends = [s.lastIndexOf("}"), s.lastIndexOf("]")].filter((i) => i >= 0);
  if (!starts.length || !ends.length) return s;
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  return end > start ? s.slice(start, end + 1) : s;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const clampPoints = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
};
/** Slugify an option label into a stable value; fall back to o1/o2… by index. */
const optValue = (label: string, i: number): string => {
  const v = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return v || `o${i + 1}`;
};

/**
 * Parse an AI reply into validated BuilderQuestions. Tolerant of a bare array
 * or a {questions:[…]} wrapper, of missing/extra fields, and of fenced output.
 * Returns [] when nothing usable is present, so callers can keep the current
 * questions rather than wiping them.
 */
export function parseQuestions(reply: string): BuilderQuestion[] {
  const cleaned = stripFences(reply);
  // Try the clean payload first (keeps bare arrays intact); only slice to the
  // outermost bracket if that fails, e.g. when the model wraps JSON in prose.
  let parsed = tryParse(cleaned);
  if (parsed === undefined) parsed = tryParse(sliceOutermost(cleaned));
  if (parsed === undefined) return [];
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown })?.questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];

  const out: BuilderQuestion[] = [];
  for (const item of raw.slice(0, MAX_QUESTIONS)) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const prompt = str(q.prompt);
    if (!prompt) continue;
    const kind: BuilderQuestionKind = KINDS.includes(q.kind as BuilderQuestionKind) ? (q.kind as BuilderQuestionKind) : "single";
    const id = `q${out.length + 1}`;

    if (kind === "number" || kind === "text") {
      out.push({ id, prompt, kind, required: true, ...(str(q.placeholder) ? { placeholder: str(q.placeholder) } : {}) });
      continue;
    }

    // single / multi need options; synthesize a yes/no if the model gave none.
    const rawOpts = Array.isArray(q.options) ? q.options : [];
    const options: BuilderOption[] = [];
    for (const ro of rawOpts.slice(0, MAX_OPTIONS)) {
      if (!ro || typeof ro !== "object") continue;
      const o = ro as Record<string, unknown>;
      const label = str(o.label) || str(o.value);
      if (!label) continue;
      options.push({
        value: str(o.value) ? optValue(str(o.value), options.length) : optValue(label, options.length),
        label,
        points: clampPoints(o.points),
        ...(o.disqualify === true ? { disqualify: true } : {}),
      });
    }
    if (options.length < 2) {
      options.length = 0;
      options.push({ value: "yes", label: "Yes", points: 10 }, { value: "no", label: "No", points: 0 });
    }
    out.push({ id, prompt, kind, required: true, options });
  }
  return out;
}
