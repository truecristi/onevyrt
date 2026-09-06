import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import { ensurePersonalWorkspace } from "../lib/workspaces";
import { claimFunnel } from "../lib/acquisition/leads";
import { notifyFunnelWorkspace } from "../lib/acquisition/notify";
import { pgPool } from "../lib/db";
import { uid, purgeUsersByEmailPrefix } from "./helpers/pg";

const PREFIX = uid("acq-notify");
const SLUG = "anotify-" + Math.random().toString(36).slice(2, 8);
after(async () => {
  await pgPool().query("DELETE FROM qual_funnel_owners WHERE slug = $1", [SLUG]);
  await purgeUsersByEmailPrefix(PREFIX);
});

test("notifyFunnelWorkspace notifies the owning workspace's members, deduped", async () => {
  const user = await auth.registerUser(`${PREFIX}@example.com`, "correct-horse-1");
  const ws = await ensurePersonalWorkspace(user.id);
  await claimFunnel(SLUG, ws.id); // now funnelOwner(SLUG) === ws.id

  await notifyFunnelWorkspace(SLUG, { type: "call_booked", title: "New call booked 📅", body: "Someone booked.", linkUrl: "/business/leads", dedupeKey: "booking:abc" });

  const first = await pgPool().query("SELECT id, title, link_url FROM notifications WHERE user_id = $1 AND type = 'call_booked'", [user.id]);
  assert.equal(first.rowCount, 1, "the owner got one notification");
  assert.equal(first.rows[0].title, "New call booked 📅");
  assert.equal(first.rows[0].link_url, "/business/leads");

  // Same dedupeKey again → no second notification.
  await notifyFunnelWorkspace(SLUG, { type: "call_booked", title: "New call booked 📅", body: "Someone booked.", linkUrl: "/business/leads", dedupeKey: "booking:abc" });
  const second = await pgPool().query("SELECT count(*)::int n FROM notifications WHERE user_id = $1 AND type = 'call_booked'", [user.id]);
  assert.equal(second.rows[0].n, 1, "re-delivery with the same key doesn't double-notify");
});

test("an unowned funnel notifies nobody (and doesn't throw)", async () => {
  // No qual_funnel_owners row for this slug → funnelOwner is null.
  await notifyFunnelWorkspace("anotify-nobody-" + Math.random().toString(36).slice(2, 6), { type: "qualified_lead", title: "x", body: "y" });
  assert.ok(true, "returned without throwing");
});
