import test, { after } from "node:test";
import assert from "node:assert/strict";
import { buildInsightsSnapshot } from "../lib/insights/snapshot";
import { recordLead } from "../lib/acquisition/leads";
import { setFunnelSpend } from "../lib/acquisition/funnel-events";
import { saveCreative, setCreativeSpend } from "../lib/campaign/creatives-store";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS = uid("insight-ws");
const SLUG = "insight-fn-" + Math.random().toString(36).slice(2, 7);
const TODAY = new Date().toISOString().slice(0, 10);

after(async () => {
  await pgPool().query("DELETE FROM creatives WHERE workspace_id = $1", [WS]);
  await pgPool().query("DELETE FROM leads WHERE funnel_slug = $1", [SLUG]);
  await pgPool().query("DELETE FROM funnel_spend WHERE workspace_id = $1", [WS]);
});

test("snapshot aggregates overview, economics, and angle performance", async () => {
  const c = await saveCreative(WS, { funnelSlug: SLUG, creativeId: "coi", headline: "Every week costs leads", angle: "Cost of inaction", score: 88 });
  await setCreativeSpend(WS, c.id, 200); // creative-level spend → angle CAC
  await setFunnelSpend(WS, SLUG, 300, "USD"); // funnel-level spend → economics CAC
  // 3 leads on this creative, 2 qualified.
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 90, email: "q1@x.com", attribution: { creativeId: c.creativeId } });
  await recordLead({ funnelSlug: SLUG, status: "qualified", score: 80, email: "q2@x.com", attribution: { creativeId: c.creativeId } });
  await recordLead({ funnelSlug: SLUG, status: "nurture", score: 40, email: "n1@x.com", attribution: { creativeId: c.creativeId } });
  // Own the leads to the workspace (recordLead stamps NULL for an unowned funnel).
  await pgPool().query("UPDATE leads SET workspace_id = $1 WHERE funnel_slug = $2", [WS, SLUG]);

  const snap = await buildInsightsSnapshot(WS, TODAY);
  assert.equal(snap.overview.leadsTotal, 3);
  assert.equal(snap.overview.qualified, 2);
  assert.equal(Math.round(snap.overview.qualifyRate * 100), 67);
  assert.equal(snap.economics.spend, 300);
  assert.equal(snap.economics.costPerQualified, 150, "300 funnel spend / 2 qualified");

  const angle = snap.angles.find((a) => a.angle === "Cost of inaction");
  assert.ok(angle, "the angle appears");
  assert.equal(angle!.qualified, 2);
  assert.equal(angle!.costPerQualified, 100, "200 creative spend / 2 qualified");
  assert.equal(snap.creatives.some((x) => x.headline === "Every week costs leads"), true);
});

test("an empty workspace yields a clean, empty snapshot", async () => {
  const snap = await buildInsightsSnapshot(uid("insight-empty"), TODAY);
  assert.equal(snap.overview.leadsTotal, 0);
  assert.deepEqual(snap.funnels, []);
  assert.deepEqual(snap.angles, []);
  assert.equal(snap.currency, "USD");
});
