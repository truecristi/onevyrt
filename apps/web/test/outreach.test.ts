import test from "node:test";
import assert from "node:assert/strict";
import { OUTREACH_CHANNELS, channelById, buildOutreachPrompt, buildFollowupPrompt, parseOutreach, OUTREACH_SYSTEM, FOLLOWUP_SYSTEM } from "../lib/studio/outreach";
import type { OfferData } from "../lib/studio/offer-coach";

const OFFER: OfferData = { name: "The Funnel Fix Sprint", promise: "booked calls in 14 days", audience: "coaches", edge: "scored before you spend", deliverables: [], price: "", priceAnchor: "", guarantee: "", objections: [], alternative: "" };

test("channels are well-formed and resolvable", () => {
  for (const c of OUTREACH_CHANNELS) { assert.ok(c.label && c.note && c.words > 0); }
  assert.equal(channelById("dm")?.label, "DM / text");
  assert.equal(channelById("nope"), undefined);
});

test("system pins JSON + the anti-salesy rules", () => {
  assert.match(OUTREACH_SYSTEM, /ONLY minified JSON/);
  assert.match(OUTREACH_SYSTEM, /"messages"/);
  assert.match(OUTREACH_SYSTEM, /earns a reply/i);
});

test("buildOutreachPrompt grounds in offer + message and sets the channel limits", () => {
  const p = buildOutreachPrompt(OFFER, { character: "first-time founders", internalProblem: "every pound is a guess" }, "dm");
  assert.match(p, /Offer: The Funnel Fix Sprint/);
  assert.match(p, /Who it's for: coaches/);
  assert.match(p, /Customer: first-time founders/);
  assert.match(p, /Channel: DM \/ text/);
  assert.match(p, /under 45 words/);
  assert.match(p, /Write 3 distinct first messages now\./);
  // falls back cleanly with nothing saved
  assert.match(buildOutreachPrompt(null, null, "email"), /general small-business service/i);
  assert.match(buildOutreachPrompt(null, null, "email"), /Channel: Cold email/);
});

test("buildFollowupPrompt: shorter limit, no-guilt system, grounded", () => {
  assert.match(FOLLOWUP_SYSTEM, /never guilt-trip/i);
  assert.match(FOLLOWUP_SYSTEM, /ONLY minified JSON/);
  const p = buildFollowupPrompt(OFFER, { character: "coaches" }, "dm");
  assert.match(p, /follow-ups now \(for someone who hasn't replied yet\)/);
  // 45 * 0.7 = 31.4999… (float) -> rounds to 31
  assert.match(p, /shorter than 31 words/);
  assert.match(p, /A fresh angle to lead with: scored before you spend/);
});

test("parseOutreach cleans, dedupes, caps, tolerates fences/array/garbage", () => {
  const reply = "```json\n" + JSON.stringify({ messages: ["Hey — saw you run funnels.", "hey — saw you run funnels.", "  ", "Different opener here."] }) + "\n```";
  const out = parseOutreach(reply);
  assert.equal(out.length, 2); // dup (case-insensitive) + empty dropped
  assert.equal(out[0], "Hey — saw you run funnels.");
  // bare array works
  assert.deepEqual(parseOutreach(JSON.stringify(["one", "two"])), ["one", "two"]);
  // garbage → []
  assert.deepEqual(parseOutreach("sorry, I can't"), []);
});
