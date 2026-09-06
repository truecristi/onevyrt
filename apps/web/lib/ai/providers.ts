/**
 * Bring-your-own-AI: the set of chat providers a user can connect with their
 * own API key, and pure adapters that turn a (system, user) prompt into the
 * right HTTP request for each — and turn each provider's response back into
 * plain text.
 *
 * OpenAI, OpenRouter and xAI (Grok) all speak the OpenAI chat-completions
 * shape, so they share one adapter. Anthropic (Claude) uses its Messages API,
 * which puts the system prompt at the top level and returns content blocks —
 * so it gets its own branch. "Manual" means no AI: the user writes the copy
 * themselves.
 *
 * Everything here is pure and browser-safe (no secrets, no I/O) so it can be
 * unit-tested and used from the client. The key is saved to the workspace
 * (encrypted server-side, see lib/ai-connection-store) for durability, but the
 * actual AI call still goes straight from the browser to the provider — the app
 * never proxies generations.
 */
export type AIProviderId = "openai" | "anthropic" | "xai" | "openrouter" | "manual";

/** Wire format — which request/response shape a provider speaks. */
export type AIFormat = "openai" | "anthropic";

export interface AIProvider {
  id: AIProviderId;
  name: string;
  hue: string;
  icon: string;
  /** Chat endpoint; "" for the manual (no-AI) option. */
  endpoint: string;
  format: AIFormat;
  /** A sensible default model if the user doesn't pick one. */
  defaultModel: string;
  /** Suggested models (the user can still type any model id). */
  models: string[];
  /** Expected key prefix, for a soft "that doesn't look right" hint only. */
  keyPrefix?: string;
  /** Where the user gets a key. */
  keyUrl: string;
  /** One line shown under the connect field. */
  note: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    hue: "#10a37f",
    icon: "🤖",
    endpoint: "https://api.openai.com/v1/chat/completions",
    format: "openai",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Paste an OpenAI API key (starts with sk-). Calls go straight to OpenAI from your browser.",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    hue: "#d97757",
    icon: "🧠",
    endpoint: "https://api.anthropic.com/v1/messages",
    format: "anthropic",
    defaultModel: "claude-3-5-haiku-latest",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-sonnet-4-latest"],
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Paste an Anthropic API key (starts with sk-ant-). Calls go straight to Anthropic from your browser.",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    hue: "#111827",
    icon: "✴️",
    endpoint: "https://api.x.ai/v1/chat/completions",
    format: "openai",
    defaultModel: "grok-2-latest",
    models: ["grok-2-latest", "grok-2-mini", "grok-beta"],
    keyPrefix: "xai-",
    keyUrl: "https://console.x.ai",
    note: "Paste an xAI API key (starts with xai-). Grok speaks the OpenAI format.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    hue: "#6467f2",
    icon: "🔀",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai",
    defaultModel: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5", "meta-llama/llama-3.1-70b-instruct"],
    keyUrl: "https://openrouter.ai/keys",
    note: "One key, many models. Prefix a model with its vendor, e.g. anthropic/claude-3.5-sonnet.",
  },
  {
    id: "manual",
    name: "Manual (no AI)",
    hue: "#6b7280",
    icon: "✍️",
    endpoint: "",
    format: "openai",
    defaultModel: "",
    models: [],
    keyUrl: "",
    note: "No AI connected — you write and edit the copy yourself.",
  },
];

export function getAIProvider(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

/** True if this provider can actually run a generation (i.e. not manual). */
export function providerCanGenerate(id: string): boolean {
  const p = getAIProvider(id);
  return Boolean(p && p.id !== "manual" && p.endpoint);
}

export interface AIHttpRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** A conversation turn (no system role — the system prompt is passed
 *  separately so each provider can place it where its API expects). */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build the HTTP request for a multi-turn chat completion. Throws for the
 * manual provider (nothing to call). The system prompt goes top-level for
 * Anthropic and as a leading system message for OpenAI-shaped providers.
 */
export function buildAIChatRequest(
  provider: AIProvider,
  apiKey: string,
  model: string,
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
): AIHttpRequest {
  if (!provider.endpoint) throw new Error(`${provider.name} has no endpoint to call.`);
  const m = model.trim() || provider.defaultModel;

  if (provider.format === "anthropic") {
    return {
      url: provider.endpoint,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Anthropic blocks browser CORS unless this opt-in header is present.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: m, max_tokens: maxTokens, system, messages }),
    };
  }

  // openai / openrouter / xai — identical chat-completions shape.
  return {
    url: provider.endpoint,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      // OpenRouter attribution (optional but recommended) — identifies the app
      // in OpenRouter's dashboards/rankings. Only sent for openrouter so the
      // other providers' requests stay minimal.
      ...(provider.id === "openrouter"
        ? { "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://onevyrt.masteryresearch.com", "X-Title": "OneVYRT" }
        : {}),
    },
    body: JSON.stringify({
      model: m,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  };
}

/**
 * Build the HTTP request for a single-shot (system + user) completion — a thin
 * convenience over buildAIChatRequest.
 */
export function buildAIRequest(
  provider: AIProvider,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): AIHttpRequest {
  return buildAIChatRequest(provider, apiKey, model, system, [{ role: "user", content: user }], maxTokens);
}

/**
 * Body for a STREAMING completion — identical to buildAIRequest but asks the
 * provider to stream tokens as Server-Sent Events (both wire formats support
 * `stream: true`). The response is a text/event-stream the caller reads
 * incrementally (see lib/ai/client.ts streamAI).
 */
export function buildAIStreamRequest(
  provider: AIProvider,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): AIHttpRequest {
  const base = buildAIRequest(provider, apiKey, model, system, user, maxTokens);
  const body = JSON.parse(base.body) as Record<string, unknown>;
  body.stream = true;
  return { ...base, body: JSON.stringify(body) };
}

/**
 * Pull the incremental text out of ONE parsed SSE `data:` object, for either
 * wire format. Returns "" for the many non-text events in a stream (role
 * deltas, pings, block start/stop, usage) so the caller can simply append
 * whatever this returns. OpenAI-shape puts it at choices[0].delta.content;
 * Anthropic emits it as content_block_delta events with a text_delta.
 */
export function streamDeltaText(provider: AIProvider, data: unknown): string {
  const d = data as Record<string, unknown>;
  if (provider.format === "anthropic") {
    if (d?.type !== "content_block_delta") return "";
    const delta = d.delta as Record<string, unknown> | undefined;
    return delta && delta.type === "text_delta" && typeof delta.text === "string" ? delta.text : "";
  }
  const choices = Array.isArray(d?.choices) ? (d.choices as Array<Record<string, unknown>>) : [];
  const delta = choices[0]?.delta as Record<string, unknown> | undefined;
  return typeof delta?.content === "string" ? delta.content : "";
}

/** Extract the assistant's plain text from a provider's JSON response. */
export function parseAIResponse(provider: AIProvider, json: unknown): string {
  const j = json as Record<string, unknown>;
  if (provider.format === "anthropic") {
    const content = Array.isArray(j?.content) ? (j.content as Array<Record<string, unknown>>) : [];
    return content
      .filter((b) => b?.type === "text" && typeof b?.text === "string")
      .map((b) => b.text as string)
      .join("")
      .trim();
  }
  const choices = Array.isArray(j?.choices) ? (j.choices as Array<Record<string, unknown>>) : [];
  const message = choices[0]?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  return typeof content === "string" ? content.trim() : "";
}

/** Soft validation: does the key look plausible for this provider? (Never
 *  blocks — just powers a gentle "that doesn't look like an X key" hint.) */
export function keyLooksValid(provider: AIProvider, apiKey: string): boolean {
  const k = apiKey.trim();
  if (!k) return false;
  if (provider.keyPrefix) return k.startsWith(provider.keyPrefix);
  return k.length >= 12;
}
