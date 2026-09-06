"use client";
/**
 * Client-side loader for the Business-OS strategy brief (server-formatted by
 * lib/business-brief.ts via /api/business/brief). The AI generators call this
 * alongside loadBrandProfile() so generation is grounded in BOTH the brand
 * voice and the actual strategy. Best-effort: any failure yields null and the
 * caller simply skips the STRATEGY block.
 */

export interface StrategyBrief { brief: string; has: boolean }

/** Fetches the workspace's strategy brief. Returns null on 401/403/network. */
export async function loadStrategyBrief(): Promise<StrategyBrief | null> {
  try {
    const r = await fetch("/api/business/brief", { credentials: "include" });
    if (!r.ok) return null;
    const d = (await r.json()) as StrategyBrief;
    return d && d.has && typeof d.brief === "string" ? d : null;
  } catch {
    return null;
  }
}

/** The prompt block to splice in, or "" when there's no strategy to ground on. */
export function strategyBlock(s: StrategyBrief | null | undefined): string {
  return s && s.has && s.brief ? `BUSINESS STRATEGY (ground advice in this — never contradict it):\n${s.brief}` : "";
}
