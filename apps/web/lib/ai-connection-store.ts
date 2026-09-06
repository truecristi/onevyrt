/**
 * Server-side persistence for a workspace's BYO-AI connection (provider, model,
 * and the API key). Durability: it lives in Postgres (the `aiConnection`
 * section of the workspace_business blob, same store as economics/offer), so it
 * survives a container restart, a move, and a backup restore — unlike the old
 * browser-localStorage-only key that vanished on any browser clear.
 *
 * The API key is the one sensitive field, so it's stored ENCRYPTED via
 * lib/crypto-box (AES-256-GCM). When AI_ENCRYPTION_KEY isn't configured on the
 * server, encryption returns null and we simply don't persist the key
 * server-side — the client keeps its existing browser-only behaviour, so this
 * is safe to ship before the env var is set.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { encryptSecret, decryptSecret, secretStorageConfigured } from "./crypto-box";
import { getAIProvider } from "./ai/providers";
import type { AIProviderId } from "./ai/providers";

/** What's stored in workspace_business.aiConnection — the key is ciphertext. */
interface StoredAiConnection {
  provider: string;
  keyCipher?: string | null;
  model?: string;
  updatedAt?: string;
}

/** What the API hands back to the authenticated owner (key decrypted, for the
 *  browser to call the provider directly — the whole point of BYO). */
export interface AiConnectionOut {
  /** true when the server can persist keys (AI_ENCRYPTION_KEY is set). */
  configured: boolean;
  provider: AIProviderId;
  model: string;
  /** decrypted key, or "" when none stored / storage unconfigured. */
  apiKey: string;
  updatedAt?: string;
}

const DEFAULT_PROVIDER: AIProviderId = "openrouter";

function coerceProvider(p: unknown): AIProviderId {
  return typeof p === "string" && getAIProvider(p) ? (p as AIProviderId) : DEFAULT_PROVIDER;
}

/**
 * Read a workspace's AI connection. `includeKey` gates the one sensitive field:
 * the decrypted API key is only returned to callers the route has confirmed may
 * see it (owner/manager). For everyone else the key comes back as "" so the
 * provider/model still render but a read-only viewer can't exfiltrate the
 * owner's provider key (they fall back to managed AI instead).
 */
export async function getAiConnection(workspaceId: string, includeKey = true): Promise<AiConnectionOut> {
  const configured = secretStorageConfigured();
  const biz = await getBusiness(workspaceId);
  const raw = biz.aiConnection as StoredAiConnection | undefined;
  if (!raw) {
    return { configured, provider: DEFAULT_PROVIDER, model: "", apiKey: "" };
  }
  return {
    configured,
    provider: coerceProvider(raw.provider),
    model: typeof raw.model === "string" ? raw.model : "",
    apiKey: includeKey ? (decryptSecret(raw.keyCipher) ?? "") : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export interface SaveAiConnectionInput {
  provider?: unknown;
  apiKey?: unknown;
  model?: unknown;
}

/**
 * Persist a workspace's AI connection. The key is encrypted; if encryption
 * isn't configured (no env key) the key is NOT stored — provider/model still
 * persist, and `configured:false` tells the client to keep the key local.
 * Returns the same shape as getAiConnection (key echoed back for the client).
 */
export async function saveAiConnection(workspaceId: string, input: SaveAiConnectionInput): Promise<AiConnectionOut> {
  const configured = secretStorageConfigured();
  const provider = coerceProvider(input.provider);
  const model = typeof input.model === "string" ? input.model.slice(0, 200) : "";
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.slice(0, 400) : "";
  const keyCipher = apiKey ? encryptSecret(apiKey) : null; // null when unconfigured or empty
  const updatedAt = new Date().toISOString();

  const stored: StoredAiConnection = { provider, model, keyCipher, updatedAt };
  await saveBusinessSection(workspaceId, "aiConnection", stored);

  return {
    configured,
    provider,
    model,
    // Only echo the key back when we actually stored it (or storage is off but
    // the client sent one — it stays the source of truth in that fallback case).
    apiKey: keyCipher ? apiKey : (configured ? "" : apiKey),
    updatedAt,
  };
}
