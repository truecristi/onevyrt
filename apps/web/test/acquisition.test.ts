import test from "node:test";
import assert from "node:assert/strict";
import { parseAttribution, readCookie, fbcFromFbclid, hasAdAttribution } from "../lib/acquisition/attribution";
import { buildCapiEvent, hashPII, hashPhone, metaCapiConfigured } from "../lib/acquisition/meta-capi";

test("parseAttribution: pulls utm + fbclid + creative ids, synthesizes fbc", () => {
  const a = parseAttribution(
    new URLSearchParams("utm_source=meta&utm_campaign=aug&gb_creative=cr_17&fbclid=ABC123"),
    { now: 1700000000000, url: "https://x.com/q/demo", referrer: "https://facebook.com" },
  );
  assert.equal(a.utmSource, "meta");
  assert.equal(a.utmCampaign, "aug");
  assert.equal(a.creativeId, "cr_17");
  assert.equal(a.fbclid, "ABC123");
  assert.equal(a.fbc, "fb.1.1700000000000.ABC123");
  assert.equal(a.landingUrl, "https://x.com/q/demo");
  assert.equal(a.referrer, "https://facebook.com");
});

test("parseAttribution: prefers a real _fbc cookie over a synthesized one", () => {
  const a = parseAttribution({ fbclid: "ABC" }, { cookies: "_fbp=fb.1.1.222; _fbc=fb.1.9.REAL", now: 1 });
  assert.equal(a.fbc, "fb.1.9.REAL");
  assert.equal(a.fbp, "fb.1.1.222");
});

test("parseAttribution: drops empty values", () => {
  const a = parseAttribution(new URLSearchParams("utm_source=&gb_ad=ad_9"));
  assert.equal("utmSource" in a, false);
  assert.equal(a.adId, "ad_9");
});

test("readCookie / fbcFromFbclid helpers", () => {
  assert.equal(readCookie("a=1; _fbp=fb.1.2.3", "_fbp"), "fb.1.2.3");
  assert.equal(readCookie(undefined, "_fbp"), undefined);
  assert.equal(fbcFromFbclid("XYZ", 42), "fb.1.42.XYZ");
});

test("hasAdAttribution: true only with an ad signal", () => {
  assert.equal(hasAdAttribution({ fbclid: "x" }), true);
  assert.equal(hasAdAttribution({ creativeId: "cr_1" }), true);
  assert.equal(hasAdAttribution({ utmSource: "google" }), false);
});

test("hashPII / hashPhone: lowercased-trimmed and digits-only sha256", () => {
  // sha256("test@example.com")
  assert.equal(hashPII("  Test@Example.com "), "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
  // phone strips punctuation before hashing
  assert.equal(hashPhone("+1 (415) 555-0000"), hashPII("14155550000"));
});

test("buildCapiEvent: hashes PII, carries fbp/fbc + dedup id + custom data", () => {
  const ev = buildCapiEvent({
    eventName: "QualifiedLead",
    user: { email: "Jane@Example.com", phone: "+44 20 7000 0000", userAgent: "UA" },
    attribution: { fbc: "fb.1.9.abc", fbp: "fb.1.1.222", utmCampaign: "aug", creativeId: "cr_17" },
    eventSourceUrl: "https://x.com/q/demo",
    customData: { qualification_score: 87 },
    eventId: "evt-1",
    nowSec: 1700000000,
  });
  assert.equal(ev.event_name, "QualifiedLead");
  assert.equal(ev.event_id, "evt-1");
  assert.equal(ev.action_source, "website");
  assert.equal(ev.user_data.em, hashPII("jane@example.com"));
  assert.equal(ev.user_data.ph, hashPhone("442070000000"));
  assert.equal(ev.user_data.fbc, "fb.1.9.abc");
  assert.equal(ev.user_data.fbp, "fb.1.1.222");
  assert.equal(ev.user_data.client_user_agent, "UA");
  assert.equal(ev.custom_data?.qualification_score, 87);
  assert.equal(ev.custom_data?.utm_campaign, "aug");
  assert.equal(ev.custom_data?.creative_id, "cr_17");
});

test("buildCapiEvent: generates a dedup id when none given", () => {
  const ev = buildCapiEvent({ eventName: "Lead", user: { email: "a@b.com" } });
  assert.match(ev.event_id, /[0-9a-f-]{36}/);
});

test("metaCapiConfigured: false without env creds", () => {
  const had = process.env.META_PIXEL_ID;
  delete process.env.META_PIXEL_ID;
  assert.equal(metaCapiConfigured(), false);
  if (had) process.env.META_PIXEL_ID = had;
});
