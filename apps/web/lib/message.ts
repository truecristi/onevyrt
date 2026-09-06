/**
 * Business OS — Message (clarity before spend). Selling starts with a message a
 * customer instantly understands: a one-liner built from Problem → Solution →
 * Result, backed by a simple story grid (who the customer is, what they want,
 * the plan, what success and failure look like). The saved one-liner is the
 * source of truth other surfaces can pull from — the funnel intro, ad creative,
 * broadcast copy — so the whole product speaks with one voice instead of blank
 * fields. Stored under the `message` section of the shared workspace_business
 * blob (lib/business.ts) — no new migration.
 *
 * Framework-agnostic story mechanics (customer-as-hero, problem/plan/stakes);
 * no external course text embedded.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { withAdvisoryLock } from "./db";

export interface OneLiner {
  problem: string;   // the pain the customer is in
  solution: string;  // what you offer (the plan/product)
  result: string;    // the successful outcome / transformation
}

export interface MessageData {
  oneLiner: OneLiner;
  // Story grid — optional depth behind the one-liner.
  character: string;   // who the customer (hero) is
  wants: string;       // what they want
  internalProblem: string; // how the problem makes them feel
  plan: string;        // the simple plan you offer
  success: string;     // what winning looks like
  failure: string;     // the stakes — what they avoid
  updatedAt?: string;
}

const EMPTY: MessageData = {
  oneLiner: { problem: "", solution: "", result: "" },
  character: "", wants: "", internalProblem: "", plan: "", success: "", failure: "",
};

export async function getMessage(workspaceId: string): Promise<MessageData> {
  const biz = await getBusiness(workspaceId);
  const m = (biz.message as MessageData | undefined) ?? EMPTY;
  const ol = (m.oneLiner ?? {}) as Partial<OneLiner>;
  return {
    oneLiner: { problem: ol.problem ?? "", solution: ol.solution ?? "", result: ol.result ?? "" },
    character: m.character ?? "", wants: m.wants ?? "", internalProblem: m.internalProblem ?? "",
    plan: m.plan ?? "", success: m.success ?? "", failure: m.failure ?? "", updatedAt: m.updatedAt,
  };
}

// Same lock family as lib/offer.ts/lib/reality.ts — see offer.ts's
// offerLockKey comment for why this is keyed per workspace+section and
// why writeMessageRaw below must stay unlocked (no re-entrant locking).
const messageLockKey = (workspaceId: string) => `workspace-business:message:${workspaceId}`;

async function writeMessageRaw(workspaceId: string, data: MessageData): Promise<MessageData> {
  const clean = sanitizeMessage(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "message", clean);
  return clean;
}

export async function saveMessage(workspaceId: string, data: MessageData): Promise<MessageData> {
  return withAdvisoryLock(messageLockKey(workspaceId), () => writeMessageRaw(workspaceId, data));
}

/** Partial-update shape for patchMessage(): oneLiner's own three fields
 *  are independently patchable (only the given ones are touched), same
 *  as every other top-level field here. */
export interface MessagePatch {
  oneLiner?: Partial<OneLiner>;
  character?: string; wants?: string; internalProblem?: string; plan?: string; success?: string; failure?: string;
}

/** True partial merge: only the fields present in `patch` are touched
 *  (and, for `oneLiner`, only its own present sub-fields) — everything
 *  else already stored survives untouched. saveMessage() (and
 *  sanitizeMessage() underneath it) always rebuilds a full MessageData
 *  from whatever's present, so a caller that only means to change ONE
 *  field (e.g. the Brand Brain route redirecting just `internalProblem`)
 *  must go through this, never call saveMessage() directly with a
 *  partial object. Runs under the SAME lock as saveMessage, so a
 *  concurrent direct saveMessage() (e.g. the user editing
 *  /business/message at the same moment) can't land between this
 *  patch's read and write and get silently overwritten by a stale
 *  merge base. */
export async function patchMessage(workspaceId: string, patch: MessagePatch): Promise<MessageData> {
  return withAdvisoryLock(messageLockKey(workspaceId), async () => {
    const current = await getMessage(workspaceId);
    const merged: MessageData = { ...current, oneLiner: { ...current.oneLiner } };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (key === "oneLiner") {
        for (const [subKey, subValue] of Object.entries(value as Partial<OneLiner>)) {
          if (subValue !== undefined) (merged.oneLiner as unknown as Record<string, unknown>)[subKey] = subValue;
        }
        continue;
      }
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
    return writeMessageRaw(workspaceId, merged);
  });
}

/** True once the one-liner is complete enough to drive downstream copy. */
export function oneLinerComplete(m: MessageData): boolean {
  const o = m.oneLiner;
  return !!(o.problem.trim() && o.solution.trim() && o.result.trim());
}

/** Compose the saved one-liner into a single sentence for reuse elsewhere. */
export function composeOneLiner(m: MessageData): string {
  const o = m.oneLiner;
  if (!oneLinerComplete(m)) return "";
  const problem = o.problem.trim().replace(/[.]+$/, "");
  const solution = o.solution.trim().replace(/[.]+$/, "");
  const result = o.result.trim().replace(/[.]+$/, "");
  return `${problem}. ${solution}, so ${result}.`;
}

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.slice(0, n) : "");

export function sanitizeMessage(v: unknown): MessageData {
  const m = (v ?? {}) as Record<string, unknown>;
  const ol = (m.oneLiner ?? {}) as Record<string, unknown>;
  return {
    oneLiner: { problem: clip(ol.problem, 400), solution: clip(ol.solution, 400), result: clip(ol.result, 400) },
    character: clip(m.character, 300), wants: clip(m.wants, 300), internalProblem: clip(m.internalProblem, 400),
    plan: clip(m.plan, 600), success: clip(m.success, 400), failure: clip(m.failure, 400),
  };
}
