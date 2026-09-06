/**
 * Managed AI — the "you provide the AI, users don't set anything up" path.
 *
 * The existing BYO flow (lib/ai/client) calls the provider straight from the
 * browser with the user's own key. This module is the server-side alternative:
 * when the owner sets MANAGED_AI_KEY, ONEVYRT can generate on the user's behalf
 * using the OWNER's key — kept server-side, never sent to the browser — metered
 * against a per-workspace monthly quota (lib/ai-usage-store) so a few heavy
 * users can't run up an unbounded bill.
 *
 * Graceful-off: with MANAGED_AI_KEY unset, managedAiConfigured() is false and
 * the /api/ai/generate route reports "not configured", so nothing changes and
 * the app stays BYO-only. Safe to ship before the env var is set.
 *
 * Config (all optional except the key):
 *   MANAGED_AI_KEY            the owner's OpenRouter API key (server-only)
 *   MANAGED_AI_MODEL          model id (default: a cheap, capable default)
 *   MANAGED_AI_MONTHLY_QUOTA  generations per workspace per month (default 50)
 *   MANAGED_AI_ENDPOINT       override the provider endpoint (default OpenRouter)
 */

const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_QUOTA = 50;
const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** True when the owner has configured a managed key (feature is on). */
export function managedAiConfigured(): boolean {
  return !!(process.env.MANAGED_AI_KEY && process.env.MANAGED_AI_KEY.trim());
}

export function managedModel(): string {
  const m = process.env.MANAGED_AI_MODEL;
  return m && m.trim() ? m.trim() : DEFAULT_MODEL;
}

/** Monthly per-workspace generation cap. Floored at 0, sane ceiling. */
export function managedMonthlyQuota(): number {
  const raw = process.env.MANAGED_AI_MONTHLY_QUOTA;
  if (!raw) return DEFAULT_QUOTA;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_QUOTA;
  return Math.min(Math.floor(n), 1_000_000);
}

function managedEndpoint(): string {
  const e = process.env.MANAGED_AI_ENDPOINT;
  return e && e.trim() ? e.trim() : DEFAULT_ENDPOINT;
}

export class ManagedAiError extends Error {
  constructor(message: string, readonly status = 502) { super(message); this.name = "ManagedAiError"; }
}

/** Hard caps so one request can't be abused into a huge (owner-funded) bill. */
export const MANAGED_PROMPT_MAX = 8000;
export const MANAGED_TOKENS_MAX = 1200;

/**
 * Generate a completion server-side with the managed key. OpenAI-compatible
 * chat-completions shape (OpenRouter and OpenAI both speak it). Throws
 * ManagedAiError on any failure so the route can translate it to a clean
 * response. Never returns or logs the key.
 */
export async function managedGenerate(system: string, prompt: string, maxTokens: number): Promise<string> {
  const key = process.env.MANAGED_AI_KEY;
  if (!key) throw new ManagedAiError("Managed AI is not configured.", 501);
  const tokens = Math.max(1, Math.min(MANAGED_TOKENS_MAX, Math.round(maxTokens) || 700));
  const body = {
    model: managedModel(),
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ],
    max_tokens: tokens,
    temperature: 0.7,
  };
  let res: Response;
  try {
    res = await fetch(managedEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        // OpenRouter attribution (harmless for plain OpenAI).
        "HTTP-Referer": "https://onevyrt.com",
        "X-Title": "ONEVYRT",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ManagedAiError("Could not reach the AI provider.", 502);
  }
  if (!res.ok) {
    // Surface a generic message; the provider's raw error may leak key/plan info.
    throw new ManagedAiError(res.status === 429 ? "The AI provider is rate-limiting right now — try again shortly." : "The AI provider returned an error.", res.status === 429 ? 429 : 502);
  }
  let json: unknown;
  try { json = await res.json(); } catch { throw new ManagedAiError("The AI provider returned an unreadable response.", 502); }
  const text = (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new ManagedAiError("The AI returned an empty response.", 502);
  return text;
}
