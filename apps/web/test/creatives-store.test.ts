import test, { after } from "node:test";
import assert from "node:assert/strict";
import { saveCreative, listCreativePerformance, deleteCreative, anglePerformance, topAngles, setCreativeSpend } from "../lib/campaign/creatives-store";
import { recordLead } from "../lib/acquisition/leads";
import { createBooking } from "../lib/acquisition/bookings";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS = uid("cre-ws");
const SLUG = "cre-fun-" + Math.random().toString(36).slice(2, 7);
after(async () => {
  await pgPool().query("DELETE FROM creatives WHERE workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM leads WHERE funnel_slug = $1", [SLUG]);
  await pgPool().query("DELETE FROM bookings WHERE funnel_slug = $1", [SLUG]);
});

test("saveCreative makes creative_id unique per workspace", async () => {
  const a = await saveCreative(WS, { funnelSlug: SLUG, creativeId: "urgency", headline: "A", score: 80 });
  const b = await saveCreative(WS, { funnelSlug: SLUG, creativeId: "urgency", headline: "B", score: 70 });
  assert.equal(a.creativeId, "urgency");
  assert.equal(b.creativeId, "urgency-2", "a colliding id is suffixed so the attribution join stays unambiguous");
});

test("performance joins real leads/qualified/booked by the creative_id in attribution", async () => {
  const c = await saveCreative(WS, { funnelSlug: SLUG, creativeId: "cost-of-inaction", headline: "Every week costs leads", angle: "Cost", score: 88 });
  // Three leads carrying this creative in their attribution — two qualified.
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 90, email: "q1@x.com", attribution: { creativeId: c.creativeId, utmSource: "meta" } });
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 75, email: "q2@x.com", attribution: { creativeId: c.creativeId } });
  await recordLead({ funnelSlug: SLUG, status: "nurture", score: 40, email: "n1@x.com", attribution: { creativeId: c.creativeId } });
  // A lead from a DIFFERENT creative must not count toward this one.
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 90, email: "other@x.com", attribution: { creativeId: "some-other-creative" } });
  await createBooking({ funnelSlug: SLUG, slotStart: "2026-08-21T09:00", email: "q1@x.com", workspaceId: WS, attribution: { creativeId: c.creativeId } });
  // Own everything to the workspace (recordLead stamps NULL for an unowned funnel).
  await pgPool().query("UPDATE leads SET workspace_id = $1 WHERE funnel_slug = $2", [WS, SLUG]);

  const perf = await listCreativePerformance(WS);
  const row = perf.find((p) => p.creativeId === c.creativeId)!;
  assert.equal(row.leads, 3, "only this creative's leads counted");
  assert.equal(row.qualified, 2);
  assert.equal(row.booked, 1);
  assert.equal(Math.round(row.qualifyRate * 100), 67);

  // Best performer (this one, 2 qualified) sorts ahead of the empty "urgency".
  assert.equal(perf[0]!.creativeId, c.creativeId);
});

test("anglePerformance rolls creatives up by angle and topAngles returns winners", async () => {
  // The prior test left a "Cost" creative with 2 qualified / 3 leads / 1 booked.
  // Add a second "Cost" creative with more, and an "Aspiration" that flops.
  const c2 = await saveCreative(WS, { funnelSlug: SLUG, creativeId: "cost-2", headline: "Cost 2", angle: "Cost", score: 60 });
  const asp = await saveCreative(WS, { funnelSlug: SLUG, creativeId: "aspiration", headline: "Dream big", angle: "Aspiration", score: 90 });
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 80, email: "c2q@x.com", attribution: { creativeId: c2.creativeId } });
  await recordLead({ funnelSlug: SLUG, status: "nurture", score: 30, email: "aspn@x.com", attribution: { creativeId: asp.creativeId } });
  await pgPool().query("UPDATE leads SET workspace_id = $1 WHERE funnel_slug = $2", [WS, SLUG]);

  const angles = await anglePerformance(WS);
  const cost = angles.find((a) => a.angle === "Cost")!;
  assert.equal(cost.creatives, 2, "both Cost creatives roll into one angle");
  assert.equal(cost.qualified, 3, "2 + 1 qualified across the Cost creatives");
  assert.equal(cost.leads, 4);
  assert.equal(cost.booked, 1);
  // Cost (3 qualified) outranks Aspiration (0 qualified).
  assert.equal(angles[0]!.angle, "Cost");
  const aspiration = angles.find((a) => a.angle === "Aspiration")!;
  assert.equal(aspiration.qualified, 0);

  const winners = await topAngles(WS);
  assert.ok(winners.includes("Cost"), "Cost is a winner (has qualified leads)");
  assert.ok(!winners.includes("Aspiration"), "an angle with no qualified leads isn't a winner");
});

test("spend drives per-creative and per-angle CAC", async () => {
  // The "cost-of-inaction" creative (from the earlier test) has 2 qualified.
  const perfBefore = await listCreativePerformance(WS);
  const cost = perfBefore.find((p) => p.creativeId === "cost-of-inaction")!;
  assert.equal(cost.costPerQualified, 0, "no spend yet → CAC 0");

  assert.equal(await setCreativeSpend(WS, cost.id, 300), true);
  const perf = await listCreativePerformance(WS);
  const c = perf.find((p) => p.id === cost.id)!;
  assert.equal(c.spend, 300);
  assert.equal(c.costPerQualified, 150, "300 ÷ 2 qualified");
  assert.equal(c.costPerBooking, 300, "300 ÷ 1 booked");

  // Angle CAC rolls the angle's spend over the angle's qualified.
  // "Cost" angle now: cost-of-inaction (300 spend, 2 qual) + cost-2 (0 spend, 1 qual) = 300 / 3.
  const angles = await anglePerformance(WS);
  const costAngle = angles.find((a) => a.angle === "Cost")!;
  assert.equal(costAngle.spend, 300);
  assert.equal(costAngle.costPerQualified, 100, "300 ÷ 3 qualified across the Cost angle");
});

test("deleteCreative removes a workspace's creative", async () => {
  const c = await saveCreative(WS, { funnelSlug: SLUG, creativeId: "to-delete", headline: "X" });
  assert.equal(await deleteCreative(WS, c.id), true);
  assert.equal((await listCreativePerformance(WS)).some((p) => p.id === c.id), false);
  assert.equal(await deleteCreative(WS, c.id), false, "second delete is a no-op");
});
