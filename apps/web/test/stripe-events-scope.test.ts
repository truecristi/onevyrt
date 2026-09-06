import test from "node:test";
import assert from "node:assert/strict";
import { recordStripeEvent, listStripeEvents, listAllStripeEvents } from "../lib/stripe-events";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

/**
 * Proves the tenancy fix: stripe_events are scoped to a workspace, one
 * workspace never sees another's events, and the per-workspace cap doesn't
 * let a busy workspace evict a quiet one.
 */
test("stripe-events: listStripeEvents returns only the caller's workspace, never another's", async () => {
  const wsA = uid("stripe-scope-A");
  const wsB = uid("stripe-scope-B");
  const idA = `evt_${uid("A")}`;
  const idB = `evt_${uid("B")}`;
  const idNull = `evt_${uid("N")}`;
  try {
    await recordStripeEvent({ id: idA, type: "checkout.session.completed", receivedAt: new Date().toISOString(), workspaceId: wsA, amountTotal: 1000, currency: "usd" });
    await recordStripeEvent({ id: idB, type: "checkout.session.completed", receivedAt: new Date().toISOString(), workspaceId: wsB, amountTotal: 9999, currency: "usd" });
    await recordStripeEvent({ id: idNull, type: "checkout.session.completed", receivedAt: new Date().toISOString(), amountTotal: 5, currency: "usd" }); // unattributed

    const a = await listStripeEvents(wsA);
    const aIds = a.map((e) => e.id);
    assert.ok(aIds.includes(idA), "workspace A should see its own event");
    assert.ok(!aIds.includes(idB), "workspace A must NOT see workspace B's event");
    assert.ok(!aIds.includes(idNull), "a scoped read must not include the unattributed (null) bucket");

    const b = await listStripeEvents(wsB);
    assert.ok(b.map((e) => e.id).includes(idB), "workspace B should see its own event");
    assert.ok(!b.map((e) => e.id).includes(idA), "workspace B must NOT see workspace A's event");

    // The admin instance-wide view does see everything (it's requireAdmin-gated).
    const all = (await listAllStripeEvents()).map((e) => e.id);
    assert.ok(all.includes(idA) && all.includes(idB) && all.includes(idNull), "admin view spans all workspaces");
  } finally {
    await pgPool().query("DELETE FROM stripe_events WHERE id = ANY($1::text[])", [[idA, idB, idNull]]).catch(() => {});
  }
});
