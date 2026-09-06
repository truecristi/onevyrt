import test, { after } from "node:test";
import assert from "node:assert/strict";
import { funnelAnalytics, setFunnelSpend } from "../lib/acquisition/funnel-events";
import { recordLead, markLeadVerified } from "../lib/acquisition/leads";
import { createBooking } from "../lib/acquisition/bookings";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const SLUG = "fetest-" + Math.random().toString(36).slice(2, 8);
const WS = uid("fe-ws");
after(async () => {
  await pgPool().query("DELETE FROM funnel_events WHERE funnel_slug LIKE 'fetest-%'");
  await pgPool().query("DELETE FROM funnel_event_daily WHERE funnel_slug LIKE 'fetest-%'");
  await pgPool().query("DELETE FROM funnel_spend WHERE funnel_slug LIKE 'fetest-%'");
  await pgPool().query("DELETE FROM leads WHERE funnel_slug LIKE 'fetest-%'");
  await pgPool().query("DELETE FROM bookings WHERE funnel_slug LIKE 'fetest-%'");
});

// funnel_events records with NULL workspace when unowned, so stamp workspace by
// inserting directly for the test (recordFunnelEvent resolves owner from the
// funnel tables, which this synthetic slug has none of). Analytics counts now
// read the funnel_event_daily rollup, so bump it in lockstep — exactly what
// recordFunnelEvent does.
async function stampEvent(type: "view" | "start", n: number, source?: string) {
  for (let i = 0; i < n; i++) {
    await pgPool().query(
      "INSERT INTO funnel_events (id, funnel_slug, workspace_id, type, attribution) VALUES (gen_random_uuid()::text,$1,$2,$3,$4)",
      [SLUG, WS, type, source ? JSON.stringify({ utmSource: source }) : null],
    );
  }
  await pgPool().query(
    `INSERT INTO funnel_event_daily (workspace_id, funnel_slug, type, day, count)
     VALUES ($1, $2, $3, CURRENT_DATE, $4)
     ON CONFLICT (workspace_id, funnel_slug, type, day) DO UPDATE SET count = funnel_event_daily.count + $4`,
    [WS, SLUG, type, n],
  );
}

test("funnelAnalytics rolls the whole funnel up with per-stage counts", async () => {
  await stampEvent("view", 10);
  await stampEvent("start", 6);
  // 4 leads: 2 qualified (1 verified + booked), 1 nurture, 1 unqualified
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 90, email: "q1@example.com", attribution: { utmSource: "meta" } });
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 80, email: "q2@example.com", attribution: { utmSource: "google" } });
  await recordLead({ funnelSlug: SLUG, status: "nurture", score: 40, email: "n1@example.com", attribution: { utmSource: "meta" } });
  await recordLead({ funnelSlug: SLUG, status: "unqualified", score: 5, email: "u1@example.com" });
  // Owner these leads to the test workspace (recordLead stamps NULL for an unowned funnel).
  await pgPool().query("UPDATE leads SET workspace_id = $1 WHERE funnel_slug = $2", [WS, SLUG]);
  await markLeadVerified(SLUG, "q1@example.com");
  await createBooking({ funnelSlug: SLUG, slotStart: "2026-08-20T09:00", email: "q1@example.com", workspaceId: WS });

  const r = await funnelAnalytics(WS, SLUG);
  assert.equal(r.views, 10);
  assert.equal(r.starts, 6);
  assert.equal(r.leads, 4);
  assert.equal(r.qualified, 2);
  assert.equal(r.nurture, 1);
  assert.equal(r.unqualified, 1);
  assert.equal(r.verified, 1);
  assert.equal(r.booked, 1);
  const stageCounts = Object.fromEntries(r.stages.map((s) => [s.key, s.count]));
  assert.deepEqual(stageCounts, { views: 10, starts: 6, leads: 4, qualified: 2, verified: 1, booked: 1 });
});

test("per-ad breakdown groups leads by source", async () => {
  const r = await funnelAnalytics(WS, SLUG);
  const meta = r.byAd.find((a) => a.source === "meta");
  const google = r.byAd.find((a) => a.source === "google");
  assert.equal(meta?.leads, 2, "meta drove 2 leads (1 qualified, 1 nurture)");
  assert.equal(meta?.qualified, 1);
  assert.equal(google?.qualified, 1);
  const direct = r.byAd.find((a) => a.source === "direct");
  assert.equal(direct?.leads, 1, "the lead with no attribution is 'direct'");
});

test("spend drives CAC", async () => {
  await setFunnelSpend(WS, SLUG, 600, "USD");
  const r = await funnelAnalytics(WS, SLUG);
  assert.equal(r.spend, 600);
  assert.equal(r.costPerQualified, 300); // 600 / 2 qualified
  assert.equal(r.costPerBooking, 600); // 600 / 1 booked
});

test("a different workspace sees none of it", async () => {
  const r = await funnelAnalytics(`${WS}-other`, SLUG);
  assert.equal(r.views, 0);
  assert.equal(r.leads, 0);
  assert.equal(r.booked, 0);
});
