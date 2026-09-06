"use client";
/**
 * Compatibility shim over the canonical multi-provider AI client
 * (lib/ai/client.ts). The Business OS steps historically imported these helpers
 * from here when this was an OpenRouter-only client; they now delegate to the
 * shared client, so EVERY AI call across the app — Business OS, Campaign Studio,
 * the funnel canvas — uses ONE connection and works with whatever provider the
 * user connected (OpenAI / Claude / Grok / OpenRouter), not just OpenRouter.
 * Kept as a thin adapter so those pages didn't need rewriting. When the user
 * brings their own key the request goes straight from the browser to their
 * provider; when they haven't, callAI falls back to the owner's managed AI via
 * our server (see lib/ai/client).
 */
import { callAI, loadConnection, saveConnection, type AIConnection } from "./ai/client";
import type { AIProviderId } from "./ai/providers";

export const DEFAULT_MODEL = "openai/gpt-4o-mini";

// getAiKey/getAiModel now read the ONE shared connection (lib/ai/client's
// localStorage), so a key set on any screen is the key used everywhere.
export function getAiKey(): string { return loadConnection()?.apiKey ?? ""; }
export function getAiModel(): string { return loadConnection()?.model ?? ""; }
export function getAiProvider(): AIProviderId { return loadConnection()?.provider ?? "openrouter"; }
export function setAiKey(k: string): void {
  const c = loadConnection();
  saveConnection({ provider: c?.provider ?? "openrouter", apiKey: k, model: c?.model ?? "" });
}
export function setAiModel(m: string): void {
  const c = loadConnection();
  saveConnection({ provider: c?.provider ?? "openrouter", apiKey: c?.apiKey ?? "", model: m });
}
export function setAiProvider(p: AIProviderId): void {
  const c = loadConnection();
  saveConnection({ provider: p, apiKey: c?.apiKey ?? "", model: c?.model ?? "" });
}

/**
 * Historically an OpenRouter-only call; now routes through the CONNECTED
 * provider. The key/model args are honoured when passed (Business OS calls pass
 * getAiKey()/getAiModel()), but the provider comes from the shared connection,
 * so a Claude / OpenAI / Grok key works here too — not only OpenRouter.
 */
export async function callOpenRouter(key: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const c = loadConnection();
  const conn: AIConnection = {
    provider: c?.provider ?? "openrouter",
    apiKey: key || c?.apiKey || "",
    model: model || c?.model || "",
  };
  return callAI(conn, system, user, maxTokens);
}

/** Pulls the first JSON object out of a model reply (handles ```json fences). */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : raw;
  const start = candidate.indexOf("{"), end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("The AI didn't return usable data. Try again.");
  return JSON.parse(candidate.slice(start, end + 1));
}
