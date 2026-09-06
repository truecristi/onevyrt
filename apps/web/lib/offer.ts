/**
 * Business OS — Offer store. The offer is the psychology-side counterpart to
 * break-even (the numbers side): what you sell, the promise, the value stack,
 * price framing, guarantee and objection answers. Stored under the `offer`
 * section of the shared workspace_business blob (lib/business.ts) — no new
 * migration, same pattern as lib/message.ts.
 *
 * The OfferData shape, sanitisation and scoring live in the pure
 * lib/studio/offer-coach.ts so they're testable without the db; this file is
 * just the persistence.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { withAdvisoryLock } from "./db";
import { sanitizeOffer, EMPTY_OFFER, type OfferData } from "./studio/offer-coach";

export type { OfferData } from "./studio/offer-coach";

// Same lock family as lib/message.ts/lib/reality.ts — one key per
// workspace+section, so concurrent writes to a DIFFERENT section never
// block each other (saveBusinessSection's own jsonb `||` merge already
// makes that safe), but same-section writes (a direct save racing a
// patch, or two patches) are serialized instead of losing an update.
const offerLockKey = (workspaceId: string) => `workspace-business:offer:${workspaceId}`;

export async function getOffer(workspaceId: string): Promise<OfferData> {
  const biz = await getBusiness(workspaceId);
  const raw = biz.offer as OfferData | undefined;
  return raw ? { ...sanitizeOffer(raw), updatedAt: raw.updatedAt } : { ...EMPTY_OFFER };
}

// Unlocked — only ever called from inside a withAdvisoryLock(offerLockKey)
// callback below. Never call this directly, and never add a lock here:
// saveOffer/patchOffer already hold the lock for their whole read-merge-
// write body, and a second lock acquisition on the same key from the
// same logical operation would deadlock against itself (two separate
// pooled connections, each waiting on the other to release).
async function writeOfferRaw(workspaceId: string, data: unknown): Promise<OfferData> {
  const clean = sanitizeOffer(data);
  clean.updatedAt = new Date().toISOString();
  await saveBusinessSection(workspaceId, "offer", clean);
  return clean;
}

export async function saveOffer(workspaceId: string, data: unknown): Promise<OfferData> {
  return withAdvisoryLock(offerLockKey(workspaceId), () => writeOfferRaw(workspaceId, data));
}

/** True partial merge: only the fields present in `patch` are touched —
 *  everything else already stored survives untouched. saveOffer() (and
 *  sanitizeOffer() underneath it) always rebuilds a full OfferData from
 *  whatever's present, so a caller that only means to change ONE field
 *  (e.g. the Brand Brain route redirecting just `audience`) must go
 *  through this, never call saveOffer() directly with a partial object.
 *  The read-merge-write runs under the SAME lock as saveOffer, so a
 *  concurrent direct saveOffer() (e.g. the user editing /psychology/offer
 *  at the same moment) can't land between this patch's read and write
 *  and get silently overwritten by a stale merge base. */
export async function patchOffer(workspaceId: string, patch: Partial<OfferData>): Promise<OfferData> {
  return withAdvisoryLock(offerLockKey(workspaceId), async () => {
    const current = await getOffer(workspaceId);
    const merged: OfferData = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (merged as unknown as Record<string, unknown>)[key] = value;
    }
    return writeOfferRaw(workspaceId, merged);
  });
}

export { sanitizeOffer };
