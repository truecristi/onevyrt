import test from "node:test";
import assert from "node:assert/strict";
import { conversationsForSales, leadsForConversations, visitorsForLeads, upstreamCount, adSpendForVisitors } from "../lib/studio/reach-plan";

test("conversationsForSales divides by the close rate and rounds up", () => {
  assert.equal(conversationsForSales(10, 20), 50);   // 10 / 0.20 = 50
  assert.equal(conversationsForSales(10, 30), 34);   // 33.3 -> 34
  assert.equal(conversationsForSales(3, 100), 3);    // close everything
  assert.equal(conversationsForSales(1, 25), 4);     // 1 / 0.25 = 4
});

test("conversationsForSales returns null when it can't be computed", () => {
  assert.equal(conversationsForSales(null, 20), null);
  assert.equal(conversationsForSales(0, 20), null);
  assert.equal(conversationsForSales(-5, 20), null);
  assert.equal(conversationsForSales(10, 0), null);   // 0% close rate → impossible
  assert.equal(conversationsForSales(10, -3), null);
  assert.equal(conversationsForSales(10, Number.NaN), null);
});

test("conversationsForSales caps the close rate at 100%", () => {
  assert.equal(conversationsForSales(10, 150), 10); // treated as 100%
});

test("the funnel steps back up: sales → conversations → leads → visitors", () => {
  const sales = 10;
  const convos = conversationsForSales(sales, 25);   // 10 / .25 = 40
  assert.equal(convos, 40);
  const leads = leadsForConversations(convos, 50);   // 40 / .50 = 80
  assert.equal(leads, 80);
  const visitors = visitorsForLeads(leads, 20);      // 80 / .20 = 400
  assert.equal(visitors, 400);
});

test("leads/visitors helpers share the null-safe, round-up, cap behaviour", () => {
  assert.equal(leadsForConversations(null, 50), null);
  assert.equal(leadsForConversations(40, 0), null);
  assert.equal(visitorsForLeads(80, -5), null);
  assert.equal(leadsForConversations(10, 30), 34);   // 33.3 -> 34
  assert.equal(visitorsForLeads(10, 150), 10);       // capped at 100%
  // all three are the same underlying helper
  assert.equal(upstreamCount(10, 25), conversationsForSales(10, 25));
});

test("adSpendForVisitors = visitors × cost, null-safe, never negative", () => {
  assert.equal(adSpendForVisitors(400, 1.5), 600);      // 400 × $1.50
  assert.equal(adSpendForVisitors(333, 0.9), 299.7);    // rounds to cents
  assert.equal(adSpendForVisitors(null, 2), null);
  assert.equal(adSpendForVisitors(0, 2), null);
  assert.equal(adSpendForVisitors(100, 0), null);       // free traffic isn't an ad budget
  assert.equal(adSpendForVisitors(100, -1), null);
});
