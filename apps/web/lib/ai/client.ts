/**
 * Browser-side AI caller — turns a (system, user) prompt into a completion by
 * routing to whichever provider the user connected. The request goes straight
 * from the browser to the provider (see providers.ts); the key is cached here
 * and also saved to the workspace (encrypted) for durability across devices and
 * restarts (see syncAiConnection). Any host used here must also be allowed in
 * next.config.ts's CSP connect-src.
 */
import {
  getAIProvider,
  buildAIRequest,
  buildAIChatRequest,
  buildAIStreamRequest,
  streamDeltaText,
  parseAIResponse,
  type AIProviderId,
  type ChatMessage,
  type AIHttpRequest,
  type AIProvider,
} from "./providers";

export interface AIConnection {
  provider: AIProviderId;
  apiKey: string;
  model: string;
}

/** localStorage keys — one shared AI connection across the whole app. */
export const AI_STORE = {
  provider: "gearbox:ai-provider",
  key: "gearbox:ai-key",
  model: "gearbox:ai-model",
  // Legacy single-provider (OpenRouter) key, migrated on first read.
  legacyKey: "gearbox:openrouter-key",
} as const;

/** Read the saved AI connection from localStorage, migrating the old
 *  OpenRouter-only key if that's all that's there. Returns null off-browser. */
export function loadConnection(): AIConnection | null {
  if (typeof window === "undefined") return null;
  try {
    const provider = (localStorage.getItem(AI_STORE.provider) as AIProviderId | null) ?? "openrouter";
    let apiKey = localStorage.getItem(AI_STORE.key) ?? "";
    if (!apiKey) apiKey = localStorage.getItem(AI_STORE.legacyKey) ?? "";
    const model = localStorage.getItem(AI_STORE.model) ?? "";
    return { provider, apiKey, model };
  } catch {
    return null;
  }
}

/** Write the connection to the browser cache only (no server round-trip). */
function saveLocalOnly(conn: AIConnection): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_STORE.provider, conn.provider);
    localStorage.setItem(AI_STORE.key, conn.apiKey);
    localStorage.setItem(AI_STORE.model, conn.model);
  } catch {
    /* non-fatal — private mode etc. */
  }
}

/** Best-effort PUT of the connection to the durable server store. */
async function putConnection(conn: AIConnection): Promise<void> {
  try {
    await fetch("/api/business/ai-connection", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: conn.provider, apiKey: conn.apiKey, model: conn.model }),
    });
  } catch {
    /* offline / signed-out — the local cache still holds it */
  }
}

// The connection UI calls saveConnection on every keystroke (typing a key,
// tweaking the model), so the server PUT is debounced — the local cache still
// updates synchronously on each call, but the durable write coalesces into one
// request ~700ms after the last edit instead of one per character.
let putTimer: ReturnType<typeof setTimeout> | null = null;
let pendingConn: AIConnection | null = null;
function schedulePutConnection(conn: AIConnection): void {
  if (typeof window === "undefined") return;
  pendingConn = conn;
  if (putTimer) clearTimeout(putTimer);
  putTimer = setTimeout(() => {
    putTimer = null;
    const c = pendingConn;
    pendingConn = null;
    if (c) void putConnection(c);
  }, 700);
}

/**
 * Save the AI connection. Writes the browser cache immediately (so every
 * synchronous loadConnection() keeps working) AND persists to the durable
 * server store (debounced) in the background, so the key survives a browser
 * clear, a restart, a container move, and a backup restore. When server-side
 * storage isn't configured the server simply doesn't keep the key and the
 * browser cache remains the source of truth — nothing breaks.
 */
export function saveConnection(conn: AIConnection): void {
  saveLocalOnly(conn);
  schedulePutConnection(conn);
}

/**
 * Reconcile the browser cache with the durable server copy — best-effort, run
 * once on app mount. The server is the source of truth: if it holds a stored
 * key, hydrate the local cache from it; if the server has none but the browser
 * does (and server-side storage is on), migrate the browser key up so it
 * survives the next clear. No-ops when signed out, offline, or server-side
 * storage is unconfigured.
 */
export async function syncAiConnection(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const r = await fetch("/api/business/ai-connection", { credentials: "include" });
    if (!r.ok) return; // signed out (401) etc.
    const s = (await r.json()) as { configured?: boolean; provider?: string; model?: string; apiKey?: string };
    const local = loadConnection();
    const provider = (s.provider as AIProviderId) || local?.provider || "openrouter";
    if (s.apiKey) {
      saveLocalOnly({ provider, apiKey: s.apiKey, model: s.model ?? local?.model ?? "" });
    } else if (s.configured && local?.apiKey) {
      void putConnection(local); // migrate the pre-existing browser key up, once
    } else if (s.provider && !local?.apiKey) {
      saveLocalOnly({ provider, apiKey: "", model: s.model ?? local?.model ?? "" });
    }
  } catch {
    /* offline / non-fatal */
  }
}

/** Resolve + validate the connection, returning its provider. Throws a
 *  user-facing Error when nothing usable is connected. */
function requireProvider(conn: AIConnection): AIProvider {
  const provider = getAIProvider(conn.provider);
  if (!provider) throw new Error("No AI provider selected.");
  if (provider.id === "manual" || !provider.endpoint) {
    throw new Error("No AI is connected — connect a provider or write the copy yourself.");
  }
  if (!conn.apiKey.trim()) throw new Error(`Add your ${provider.name} API key to generate.`);
  return provider;
}

// A generous ceiling so a hung provider can't leave the caller's "generating…"
// state spinning forever. 700-token completions finish well within this; the
// cap only ever fires on a genuinely stuck request.
const AI_TIMEOUT_MS = 90_000;

// Transient failures worth retrying: rate limits (429) and gateway/overload
// 5xx. A 400/401/403 is the user's key or request and must fail immediately —
// retrying it only wastes their time. Exposed (underscored) so tests can shrink
// the backoff base; production uses ~0.5s → 1s exponential with full jitter.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
export const _retryConfig = { attempts: 3, baseMs: 500 };
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
function backoffMs(attempt: number): number {
  const base = _retryConfig.baseMs * 2 ** (attempt - 1);
  return Math.round(base * (0.5 + Math.random() * 0.5)); // full jitter
}

// A caller-initiated cancel (Stop button) throws this — distinct from a
// transient failure so the retry loop stops immediately instead of retrying.
const CANCELLED = "Generation cancelled.";

async function run(provider: AIProvider, req: AIHttpRequest, signal?: AbortSignal): Promise<string> {
  let lastErr: Error = new Error(`${provider.name} request failed.`);
  for (let attempt = 0; attempt < _retryConfig.attempts; attempt++) {
    if (signal?.aborted) throw new Error(CANCELLED);
    if (attempt > 0) await sleep(backoffMs(attempt));
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: controller.signal });
      } catch {
        if (signal?.aborted) throw new Error(CANCELLED); // user cancelled — don't retry
        // Network error / timeout — transient, so retry until attempts run out.
        lastErr = new Error(controller.signal.aborted
          ? `${provider.name} took too long to respond — try again.`
          : `Couldn't reach ${provider.name}. Check your connection and try again.`);
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const err = new Error(`${provider.name} error ${res.status}: ${detail.slice(0, 200) || res.statusText}`);
        if (RETRYABLE_STATUS.has(res.status)) { lastErr = err; continue; } // 429/5xx → retry
        throw err; // 4xx (bad key/request) → fail now, no retry
      }
      const json = (await res.json().catch(() => null)) as unknown;
      const text = parseAIResponse(provider, json);
      if (!text) throw new Error(`${provider.name} returned an empty response.`);
      return text;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastErr;
}

/**
 * Try the owner-provided "managed AI" server route (/api/ai/generate) — used
 * when the user hasn't brought their own key. Returns the completion, or null
 * when managed AI isn't enabled on this server (501) so the caller falls back
 * to the normal "add your key" path. Throws a user-facing Error for a real
 * failure (e.g. 429 monthly-limit reached, with a message that tells the user
 * to add their own key for unlimited use).
 */
async function tryManagedGenerate(system: string, user: string, maxTokens: number, signal?: AbortSignal): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch("/api/ai/generate", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system, prompt: user, maxTokens }),
      signal,
    });
  } catch {
    return null; // offline / route unavailable → fall back to BYO
  }
  if (res.status === 501) return null; // managed AI not configured on this server
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "AI generation failed.");
  return typeof data.text === "string" && data.text.trim() ? data.text : null;
}

/**
 * Run a single (system + user) completion. Uses the user's own connected
 * provider when they've added a key; otherwise falls back to the owner-provided
 * managed AI (metered by a monthly quota) so the AI works out of the box. Only
 * when neither is available does it throw the "add your key" error. Throws a
 * clear, user-facing Error on any failure.
 */
export async function callAI(conn: AIConnection, system: string, user: string, maxTokens = 700, signal?: AbortSignal): Promise<string> {
  // No BYO key on a real provider → try managed AI first.
  if (conn.provider !== "manual" && !conn.apiKey.trim()) {
    const managed = await tryManagedGenerate(system, user, maxTokens, signal);
    if (managed !== null) return managed;
    // managed not enabled → fall through to the normal validation/error below
  }
  const provider = requireProvider(conn);
  return run(provider, buildAIRequest(provider, conn.apiKey, conn.model, system, user, maxTokens), signal);
}

/**
 * Run a multi-turn chat (system + message history) against the connected
 * provider — used by the Copilot. Pass `signal` to let the caller cancel an
 * in-flight generation (e.g. a Stop button).
 */
export async function callAIChat(conn: AIConnection, system: string, messages: ChatMessage[], maxTokens = 700, signal?: AbortSignal): Promise<string> {
  const provider = requireProvider(conn);
  return run(provider, buildAIChatRequest(provider, conn.apiKey, conn.model, system, messages, maxTokens), signal);
}

/**
 * Stream a single (system + user) completion, invoking `onToken` with each
 * text delta as it arrives and resolving to the full text at the end. Same
 * provider routing, timeout, and error messages as callAI — the only
 * difference is the caller sees tokens as they land (used to render the
 * Copilot's reply progressively instead of after a long pause). Falls back
 * cleanly: any non-2xx or transport error throws the same user-facing Error
 * callAI would, so a caller can try streaming and drop back to callAI.
 */
export async function streamAI(
  conn: AIConnection,
  system: string,
  user: string,
  onToken: (delta: string) => void,
  maxTokens = 700,
  signal?: AbortSignal,
): Promise<string> {
  // No BYO key on a real provider → try managed AI. It's non-streaming, so we
  // deliver the whole completion in one onToken call (callers accumulate it).
  if (conn.provider !== "manual" && !conn.apiKey.trim()) {
    const managed = await tryManagedGenerate(system, user, maxTokens, signal);
    if (managed !== null) { onToken(managed); return managed; }
  }
  const provider = requireProvider(conn);
  return streamRun(provider, buildAIStreamRequest(provider, conn.apiKey, conn.model, system, user, maxTokens), onToken, signal);
}

/**
 * Streaming counterpart of callAIChat: multi-turn history, tokens delivered to
 * `onToken` as they arrive. Used by the Copilot to render its reply live.
 */
export async function streamAIChat(
  conn: AIConnection,
  system: string,
  messages: ChatMessage[],
  onToken: (delta: string) => void,
  maxTokens = 700,
  signal?: AbortSignal,
): Promise<string> {
  const provider = requireProvider(conn);
  const base = buildAIChatRequest(provider, conn.apiKey, conn.model, system, messages, maxTokens);
  const body = JSON.parse(base.body) as Record<string, unknown>;
  body.stream = true;
  return streamRun(provider, { ...base, body: JSON.stringify(body) }, onToken, signal);
}

/** Shared SSE reader for the streaming callers above: POST, then consume the
 *  text/event-stream, appending each text delta and returning the full text.
 *  Same timeout + user-facing errors as run(). */
async function streamRun(provider: AIProvider, req: AIHttpRequest, onToken: (delta: string) => void, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal?.aborted) throw new Error(CANCELLED);
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: controller.signal });
    } catch {
      if (signal?.aborted) throw new Error(CANCELLED); // user cancelled
      throw new Error(controller.signal.aborted
        ? `${provider.name} took too long to respond — try again.`
        : `Couldn't reach ${provider.name}. Check your connection and try again.`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${provider.name} error ${res.status}: ${detail.slice(0, 200) || res.statusText}`);
    }
    if (!res.body) throw new Error(`${provider.name} returned no stream.`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are newline-delimited; process each complete line, keeping
      // any trailing partial line in the buffer for the next chunk.
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue; // skip `event:` lines, comments, blanks
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let json: unknown;
        try { json = JSON.parse(payload); } catch { continue; }
        const delta = streamDeltaText(provider, json);
        if (delta) { full += delta; onToken(delta); }
      }
    }
    if (!full) throw new Error(`${provider.name} returned an empty response.`);
    return full;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export interface ConnectionTestResult { ok: boolean; error?: string; }

/**
 * Cheap liveness check for the connected provider: fires a 1-token completion
 * so the user can confirm a key/model actually work before relying on them.
 * A 2xx response means the credentials reached the provider and were accepted,
 * so this treats reachability + auth as success and does NOT require non-empty
 * content (a 1-token reply can legitimately be empty). Never throws — returns
 * { ok:false, error } with a user-facing message instead.
 */
export async function testConnection(conn: AIConnection): Promise<ConnectionTestResult> {
  let provider: AIProvider;
  try {
    provider = requireProvider(conn);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No AI is connected." };
  }
  const req = buildAIRequest(provider, conn.apiKey, conn.model, "Connection test.", "Reply with the single word: ok", 1);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    let res: Response;
    try {
      res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: controller.signal });
    } catch {
      return { ok: false, error: controller.signal.aborted
        ? `${provider.name} took too long to respond — try again.`
        : `Couldn't reach ${provider.name}. Check your connection and try again.` };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `${provider.name} error ${res.status}: ${detail.slice(0, 160) || res.statusText}` };
    }
    return { ok: true };
  } finally {
    clearTimeout(timer);
  }
}
