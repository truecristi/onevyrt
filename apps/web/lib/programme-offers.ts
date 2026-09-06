/**
 * The three commercial offers the productisation spec asks for — Course
 * Only, Group Coaching, Premium One-to-One — as configurable records, not
 * hard-coded prices. Instance-wide (like settings.ts), not per-workspace:
 * there is one business selling the programme, so pricing/copy is edited
 * once by an admin and read by everyone. Postgres-backed (see lib/db.ts).
 *
 * Deliberately data-only: no payment processing, no paywall enforcement.
 * Enrollment.deliveryMode already exists as the technical selector; this
 * store is the commercial layer on top (what to call it, what to charge,
 * what to say) that a human — not code — decides when to gate on.
 */
import { pgPool } from "./db";
import type { DeliveryMode } from "@onevyrt/engine";

export interface ProgrammeOffer {
  id: DeliveryMode;
  name: string;
  priceLabel: string; // free text, e.g. "$497 one-time" or "Contact for pricing" — never a hard-coded number the app computes with
  description: string;
  active: boolean;
}

const DEFAULT_OFFERS: ProgrammeOffer[] = [
  { id: "self_paced", name: "Course Only", priceLabel: "Set your price", description: "Self-paced access to the full curriculum, no coaching.", active: false },
  { id: "cohort", name: "Group Coaching", priceLabel: "Set your price", description: "The curriculum plus weekly group coaching sessions in a cohort.", active: false },
  { id: "premium_1to1", name: "Premium One-to-One", priceLabel: "Set your price", description: "The curriculum plus private 1:1 coaching and review.", active: false },
];

// Exactly three fixed ids, naturally per-row.
export async function listOffers(): Promise<ProgrammeOffer[]> {
  const res = await pgPool().query<{ id: DeliveryMode; name: string; price_label: string; description: string; active: boolean }>(
    "SELECT id, name, price_label, description, active FROM programme_offers",
  );
  const stored = new Map(res.rows.map((r) => [r.id, { id: r.id, name: r.name, priceLabel: r.price_label, description: r.description, active: r.active }]));
  return DEFAULT_OFFERS.map((d) => stored.get(d.id) ?? d);
}

const MAX_TEXT = 500;

export async function updateOffer(offerId: DeliveryMode, patch: { name?: string; priceLabel?: string; description?: string; active?: boolean }): Promise<ProgrammeOffer> {
  const all = await listOffers();
  const cur = all.find((o) => o.id === offerId);
  if (!cur) throw new Error("Unknown offer.");
  const next: ProgrammeOffer = {
    ...cur,
    name: patch.name !== undefined ? (patch.name.trim().slice(0, MAX_TEXT) || cur.name) : cur.name,
    priceLabel: patch.priceLabel !== undefined ? patch.priceLabel.trim().slice(0, MAX_TEXT) : cur.priceLabel,
    description: patch.description !== undefined ? patch.description.trim().slice(0, MAX_TEXT) : cur.description,
    active: patch.active !== undefined ? patch.active : cur.active,
  };
  await pgPool().query(
    `INSERT INTO programme_offers (id, name, price_label, description, active) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price_label = EXCLUDED.price_label, description = EXCLUDED.description, active = EXCLUDED.active`,
    [next.id, next.name, next.priceLabel, next.description, next.active],
  );
  return next;
}
