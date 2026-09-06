/**
 * Business OS — Journey store. Just the owner's journey settings: when they
 * started and the pace they picked (the done-state of each step is derived from
 * real signals elsewhere, so it isn't stored here). Persisted under the
 * `journey` section of the shared workspace_business blob (lib/business.ts) —
 * no new migration, same pattern as lib/economics.ts. Server-side so the
 * deadlines are the same on every device.
 */
import { getBusiness, saveBusinessSection } from "./business";
import { PACE_MULT, type JourneyState, type Pace } from "./studio/journey";

function sanitize(v: unknown): JourneyState {
  const o = (v ?? {}) as Record<string, unknown>;
  const out: JourneyState = {};
  if (typeof o.startedAt === "string" && !Number.isNaN(Date.parse(o.startedAt))) out.startedAt = o.startedAt;
  if (typeof o.pace === "string" && (o.pace as Pace) in PACE_MULT) out.pace = o.pace as Pace;
  return out;
}

export async function getJourney(workspaceId: string): Promise<JourneyState> {
  const biz = await getBusiness(workspaceId);
  return sanitize(biz.journey);
}

export async function saveJourney(workspaceId: string, data: unknown): Promise<JourneyState> {
  const clean = sanitize(data);
  await saveBusinessSection(workspaceId, "journey", clean);
  return clean;
}
