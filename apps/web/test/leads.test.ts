import test, { after } from "node:test";
import assert from "node:assert/strict";
import { recordLead, listWorkspaceLeads, listWorkspaceBookings, funnelOwner, claimFunnel, acquisitionSummary } from "../lib/acquisition/leads";
import { createBooking } from "../lib/acquisition/bookings";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const SLUG = uid("leads-test");
const WS = uid("leads-ws");
after(async () => {
  await pgPool().query("DELETE FROM leads WHERE funnel_slug LIKE $1", [`${SLUG}%`]);
  await pgPool().query("DELETE FROM bookings WHERE funnel_slug LIKE $1", [`${SLUG}%`]);
  await pgPool().query("DELETE FROM qual_funnel_owners WHERE slug LIKE $1", [`${SLUG}%`]);
});

test("recordLead on an unowned funnel stores workspace_id NULL — invisible to any inbox", async () => {
  const slug = `${SLUG}-a`;
  await recordLead({ funnelSlug: slug, status: "qualified", score: 100, route: "calendar_enterprise", email: "a@example.com" });
  assert.equal(await funnelOwner(slug), null);
  assert.equal((await listWorkspaceLeads(`${WS}-nobody`)).length, 0, "no workspace sees an unowned funnel's leads");
});

test("claimFunnel adopts previously-unowned leads and bookings", async () => {
  const slug = `${SLUG}-b`;
  const ws = `${WS}-b`;
  await recordLead({ funnelSlug: slug, status: "qualified", score: 90, email: "q@example.com" });
  await recordLead({ funnelSlug: slug, status: "nurture", score: 50, email: "n@example.com" });
  await createBooking({ funnelSlug: slug, slotStart: "2026-08-18T09:00", email: "q@example.com" });

  // Before claiming: nothing in this workspace's inbox.
  assert.equal((await listWorkspaceLeads(ws)).length, 0);

  const res = await claimFunnel(slug, ws);
  assert.equal(res.owner, ws);
  assert.equal(res.leads, 2, "both leads adopted");
  assert.equal(res.bookings, 1, "the booking adopted");
  assert.equal(await funnelOwner(slug), ws);

  const leads = await listWorkspaceLeads(ws);
  assert.equal(leads.length, 2);
  assert.deepEqual(leads.map((l) => l.status).sort(), ["nurture", "qualified"]);
  const bookings = await listWorkspaceBookings(ws);
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0]!.slotStart, "2026-08-18T09:00");
});

test("a lead recorded after the funnel is owned lands straight in the owner's inbox", async () => {
  const slug = `${SLUG}-c`;
  const ws = `${WS}-c`;
  await claimFunnel(slug, ws); // own it first (no rows yet)
  await recordLead({ funnelSlug: slug, status: "qualified", score: 80, email: "live@example.com" });
  const leads = await listWorkspaceLeads(ws);
  assert.equal(leads.length, 1);
  assert.equal(leads[0]!.email, "live@example.com");
});

test("another workspace cannot steal an owned funnel", async () => {
  const slug = `${SLUG}-d`;
  await claimFunnel(slug, `${WS}-d1`);
  const res = await claimFunnel(slug, `${WS}-d2`);
  assert.equal(res.owner, `${WS}-d1`, "ownership stays with the first claimer");
  assert.equal(res.leads, 0);
});

test("acquisitionSummary rolls up counts, rates and upcoming calls", async () => {
  const slug = `${SLUG}-sum`;
  const ws = `${WS}-sum`;
  await claimFunnel(slug, ws);
  await recordLead({ funnelSlug: slug, status: "qualified", score: 95, email: "q1@example.com" });
  await recordLead({ funnelSlug: slug, status: "qualified", score: 80, email: "q2@example.com" });
  await recordLead({ funnelSlug: slug, status: "nurture", score: 50, email: "n1@example.com" });
  await recordLead({ funnelSlug: slug, status: "unqualified", score: 10, email: "u1@example.com" });
  await createBooking({ funnelSlug: slug, slotStart: "2026-08-18T09:00", email: "q1@example.com", workspaceId: ws });

  // "today" well before the booking so it counts as upcoming.
  const s = await acquisitionSummary(ws, "2026-08-01");
  assert.equal(s.leadsTotal, 4);
  assert.equal(s.qualified, 2);
  assert.equal(s.nurture, 1);
  assert.equal(s.unqualified, 1);
  assert.equal(s.bookingsTotal, 1);
  assert.equal(s.upcoming, 1);
  assert.equal(s.qualifyRate, 0.5); // 2 of 4
  assert.equal(s.bookRate, 0.5); // 1 booked of 2 qualified

  // A "today" after the slot → not upcoming.
  const past = await acquisitionSummary(ws, "2026-09-01");
  assert.equal(past.upcoming, 0);
});

test("listWorkspaceLeads is newest-first", async () => {
  const slug = `${SLUG}-e`;
  const ws = `${WS}-e`;
  await claimFunnel(slug, ws);
  await recordLead({ funnelSlug: slug, status: "unqualified", score: 10, email: "first@example.com" });
  await new Promise((r) => setTimeout(r, 10));
  await recordLead({ funnelSlug: slug, status: "qualified", score: 95, email: "second@example.com" });
  const leads = await listWorkspaceLeads(ws);
  assert.equal(leads[0]!.email, "second@example.com", "most recent lead is first");
});
