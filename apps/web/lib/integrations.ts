/**
 * Campaign Studio: connected ad/social accounts (the "Advertise" registry).
 * See migrations/1786630300000_platform-connections.js for why this holds no
 * OAuth tokens yet — live platform sync needs each provider's developer app +
 * API approval, which the workspace owner obtains. Until then this records
 * which accounts a workspace has linked and their status, so the UI shows
 * real state.
 */
import { pgPool } from "./db";

export type ProviderKind = "ads" | "ads+social" | "ai";
export interface Provider { id: string; name: string; kind: ProviderKind; hue: string; icon: string; note: string; }

// The platforms the Advertise screen offers. `note` is what a user needs to
// actually run live campaigns there — set honestly, since each is gated by
// that platform's own approval process, not by us.
export const PROVIDERS: Provider[] = [
  { id: "meta", name: "Meta (Facebook & Instagram)", kind: "ads+social", hue: "#1877f2", icon: "📘", note: "Needs a Meta App with Marketing API access (app review for advanced access)." },
  { id: "google", name: "Google Ads", kind: "ads", hue: "#ea4335", icon: "🔴", note: "Needs a Google Cloud OAuth client + an approved Google Ads API developer token." },
  { id: "tiktok", name: "TikTok Ads", kind: "ads+social", hue: "#010101", icon: "🎵", note: "Needs a TikTok for Business app with Marketing API access." },
  { id: "linkedin", name: "LinkedIn Ads", kind: "ads+social", hue: "#0a66c2", icon: "💼", note: "Needs a LinkedIn Developer app with Marketing API access." },
  { id: "microsoft", name: "Microsoft (Bing) Ads", kind: "ads", hue: "#00a4ef", icon: "🪟", note: "Needs a Microsoft Advertising developer token + OAuth app." },
  { id: "snapchat", name: "Snapchat Ads", kind: "ads+social", hue: "#fffc00", icon: "👻", note: "Needs a Snap Marketing API app." },
  { id: "spotify", name: "Spotify Ads", kind: "ads", hue: "#1db954", icon: "🎧", note: "Spotify Ad Studio has no open public API — connect as a manual/reporting-only channel." },
  { id: "openai", name: "OpenAI / ChatGPT Ads", kind: "ai", hue: "#10a37f", icon: "🤖", note: "Reporting-only placeholder until a public ads API exists." },
];

export function isProvider(id: string): boolean { return PROVIDERS.some((p) => p.id === id); }

export interface Connection {
  provider: string;
  accountName: string;
  accountId?: string;
  status: "connected" | "needs_attention";
  connectedAt: string;
  updatedAt: string;
}

interface ConnRow { provider: string; account_name: string; account_id: string | null; status: string; connected_at: Date; updated_at: Date; }
function rowToConnection(r: ConnRow): Connection {
  return {
    provider: r.provider, accountName: r.account_name, ...(r.account_id ? { accountId: r.account_id } : {}),
    status: r.status === "needs_attention" ? "needs_attention" : "connected",
    connectedAt: r.connected_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listConnections(workspaceId: string): Promise<Connection[]> {
  const res = await pgPool().query<ConnRow>(
    "SELECT provider, account_name, account_id, status, connected_at, updated_at FROM platform_connections WHERE workspace_id = $1",
    [workspaceId],
  );
  return res.rows.map(rowToConnection);
}

/** Records (or updates) a linked account for a provider. A manual link today;
 *  the same row a real OAuth callback will populate with tokens later. */
export async function connectProvider(workspaceId: string, provider: string, accountName: string, accountId?: string): Promise<Connection> {
  const now = new Date().toISOString();
  const name = accountName.trim().slice(0, 200) || provider;
  const id = accountId?.trim().slice(0, 200) || null;
  const res = await pgPool().query<ConnRow>(
    `INSERT INTO platform_connections (workspace_id, provider, account_name, account_id, status, connected_at, updated_at)
     VALUES ($1, $2, $3, $4, 'connected', $5, $5)
     ON CONFLICT (workspace_id, provider) DO UPDATE SET
       account_name = EXCLUDED.account_name, account_id = EXCLUDED.account_id, status = 'connected', updated_at = EXCLUDED.updated_at
     RETURNING provider, account_name, account_id, status, connected_at, updated_at`,
    [workspaceId, provider, name, id, now],
  );
  return rowToConnection(res.rows[0]!);
}

export async function disconnectProvider(workspaceId: string, provider: string): Promise<void> {
  await pgPool().query("DELETE FROM platform_connections WHERE workspace_id = $1 AND provider = $2", [workspaceId, provider]);
}
