/**
 * Product-flow analytics (audit §27): the activation-funnel milestones must
 * actually land in app_events. track() is fire-and-forget (not awaited by the
 * feature code), so each assertion polls briefly for the row.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";
import { recordLead } from "../lib/acquisition/leads";
import { saveFunnel } from "../lib/studio/funnel-store";
import { PRODUCT_EVENT } from "../lib/product-events";

const wsId = uid("pe-ws");
const slug = uid("pe-funnel");

async function waitForEvent(name: string, workspaceId: string, ms = 3000): Promise<boolean> {
  const pool = pgPool();
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const r = await pool.query("SELECT 1 FROM app_events WHERE name = $1 AND workspace_id = $2 LIMIT 1", [name, workspaceId]);
    if ((r.rowCount ?? 0) > 0) return true;
    await new Promise((res) => setTimeout(res, 100));
  }
  return false;
}

after(async () => {
  const pool = pgPool();
  await pool.query("DELETE FROM app_events WHERE workspace_id = $1", [wsId]);
  await pool.query("DELETE FROM lead_events WHERE workspace_id = $1", [wsId]);
  await pool.query("DELETE FROM leads WHERE workspace_id = $1", [wsId]);
  await pool.query("DELETE FROM qual_funnels WHERE workspace_id = $1", [wsId]);
});

test("recordLead emits lead_created for the owning workspace", async () => {
  const pool = pgPool();
  // A published funnel owned by wsId makes funnelOwner(slug) resolve to it.
  await pool.query(
    `INSERT INTO qual_funnels (slug, workspace_id, doc, published, updated_at)
     VALUES ($1,$2,$3,true, now())`,
    [slug, wsId, JSON.stringify({ slug, title: "t", steps: [] })],
  );
  await recordLead({ funnelSlug: slug, status: "qualified", score: 80, email: `${uid("pe")}@example.com` });
  assert.ok(await waitForEvent(PRODUCT_EVENT.LEAD_CREATED, wsId), "expected a lead_created app_event");
});

test("saveFunnel emits funnel_created + funnel_published", async () => {
  // Slugs are lowercase letters/numbers/dashes only (uid() uses underscores).
  const s2 = `pe-f2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await saveFunnel(wsId, {
    slug: s2, title: "Fit check", intro: "hi", brandColor: "#088057",
    questions: [{ id: "q1", kind: "single", prompt: "Pick one", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
    thresholds: { qualified: 0, nurture: 0 },
    outcomes: {
      qualified: { heading: "You're a fit", body: "Let's talk.", ctaLabel: "Book a call" },
      nurture: { heading: "Thanks", body: "We'll be in touch.", ctaLabel: "Learn more" },
      unqualified: { heading: "Not a fit", body: "No worries.", ctaLabel: "OK" },
    },
  } as never, true);
  assert.ok(await waitForEvent(PRODUCT_EVENT.FUNNEL_CREATED, wsId), "expected a funnel_created app_event");
  assert.ok(await waitForEvent(PRODUCT_EVENT.FUNNEL_PUBLISHED, wsId), "expected a funnel_published app_event");
});
