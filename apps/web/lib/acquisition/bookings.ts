/**
 * Bookings store for the Acquisition OS. Reads the taken slots for a funnel
 * (so the availability engine can subtract them) and creates a booking with a
 * hard double-booking guard: the UNIQUE (funnel_slug, slot_start) constraint
 * means a race for the same slot lets exactly one win; the loser gets a clean
 * "slot taken" error rather than a silent second booking.
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";
import type { Attribution } from "./attribution";

export interface Booking {
  id: string;
  funnelSlug: string;
  slotStart: string;
  name?: string;
  email?: string;
  phone?: string;
  workspaceId?: string | null;
}

/** The set of slot keys already booked for a funnel within a date range
 *  (inclusive of `fromDate`, exclusive of `toDate`), as "YYYY-MM-DDTHH:MM".
 *  Excludes soft-deleted bookings (see deleted_at) — an erased booking frees
 *  its slot back up rather than holding it hostage forever. */
export async function bookedStarts(funnelSlug: string, fromDate: string, toDate: string): Promise<Set<string>> {
  const res = await pgPool().query<{ slot_start: string }>(
    "SELECT slot_start FROM bookings WHERE funnel_slug = $1 AND slot_start >= $2 AND slot_start < $3 AND deleted_at IS NULL",
    [funnelSlug, fromDate, toDate],
  );
  return new Set(res.rows.map((r) => r.slot_start));
}

export class SlotTakenError extends Error {
  constructor() { super("That time was just taken — please pick another."); this.name = "SlotTakenError"; }
}

/** Persist a booking. Throws SlotTakenError if the slot is already booked.
 *  `workspaceId` stamps the booking for the owning tenant's inbox (NULL when
 *  the funnel is unowned, e.g. the shared demo). */
export async function createBooking(input: {
  funnelSlug: string; slotStart: string; name?: string; email?: string; phone?: string; attribution?: Attribution; workspaceId?: string | null;
}): Promise<Booking> {
  const id = randomUUID();
  try {
    await pgPool().query(
      "INSERT INTO bookings (id, funnel_slug, slot_start, name, email, phone, attribution, workspace_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, input.funnelSlug, input.slotStart, input.name ?? null, input.email ?? null, input.phone ?? null, input.attribution ? JSON.stringify(input.attribution) : null, input.workspaceId ?? null],
    );
  } catch (e) {
    if (e && typeof e === "object" && (e as { code?: string }).code === "23505") throw new SlotTakenError();
    throw e;
  }
  return { id, funnelSlug: input.funnelSlug, slotStart: input.slotStart, name: input.name, email: input.email, phone: input.phone, workspaceId: input.workspaceId ?? null };
}
