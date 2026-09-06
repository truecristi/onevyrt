/**
 * SSRF guard for user-supplied destination URLs — currently used for outbound
 * webhook registration (see app/api/settings/webhooks/route.ts). A workspace
 * member can type any URL; without this, that URL becomes a way to make the
 * server issue requests to addresses the *user's browser* could never reach
 * directly — internal admin panels, cloud metadata endpoints
 * (169.254.169.254), other services on the box's own loopback interface, etc.
 *
 * This resolves the hostname and rejects anything that lands in private,
 * loopback, link-local, or otherwise non-public address space. Deliberately
 * NOT wired into dispatchEvent/createWebhook themselves — those are exercised
 * directly (with real loopback test servers) by test/webhooks.test.ts, and
 * the actual attack surface is the public HTTP API, not the library
 * functions. A hostname that resolves to a public IP at registration time and
 * gets repointed at an internal one later (DNS rebinding) isn't covered by
 * this — a real gap, but one that requires an attacker who already holds
 * owner/manager access to the workspace, which is a materially smaller threat
 * than the wide-open "type any internal URL and it just works" gap this closes.
 */
import { lookup } from "node:dns/promises";

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
}
function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

// Loopback, private (RFC1918), link-local (incl. cloud metadata), CGNAT,
// documentation/test ranges, multicast, and reserved space.
const BLOCKED_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isBlockedV4(ip: string): boolean {
  return BLOCKED_V4_RANGES.some(([base, bits]) => inV4Range(ip, base, bits));
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10 link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]!);
  return false;
}

/** True if a *resolved* IP literal is a public address safe to connect to.
 *  Exported so a DNS-pinned fetcher can validate the exact address it will
 *  connect to (closing the resolve-then-connect rebinding window that
 *  checkPublicHttpUrl alone can't). family is 4 or 6. */
export function isPublicAddress(address: string, family: number): boolean {
  return family === 6 ? !isBlockedV6(address) : !isBlockedV4(address);
}

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
}

/** Rejects anything that isn't a plain http(s) URL resolving only to public
 *  addresses. Fails closed: a hostname that doesn't resolve, or a lookup
 *  error, counts as unsafe rather than being let through. */
export async function checkPublicHttpUrl(rawUrl: string): Promise<UrlSafetyResult> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return { safe: false, reason: "not a valid URL" }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { safe: false, reason: "must be an http(s) URL" };
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return { safe: false, reason: "cannot target a local hostname" };
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return { safe: false, reason: "hostname does not resolve" };
  }
  for (const { address, family } of addresses) {
    if (family === 4 && isBlockedV4(address)) return { safe: false, reason: `resolves to a private/internal address (${address})` };
    if (family === 6 && isBlockedV6(address)) return { safe: false, reason: `resolves to a private/internal address (${address})` };
  }
  return { safe: true };
}
