import test from "node:test";
import assert from "node:assert/strict";
import { etagFor, ifNoneMatch, jsonWithETag } from "../lib/etag";

test("etagFor: stable + content-sensitive", () => {
  assert.equal(etagFor('{"a":1}'), etagFor('{"a":1}'), "same body → same etag");
  assert.notEqual(etagFor('{"a":1}'), etagFor('{"a":2}'), "different body → different etag");
  assert.match(etagFor("x"), /^".+"$/, "quoted");
});

test("ifNoneMatch: matches the exact tag or *", () => {
  const tag = etagFor("body");
  assert.equal(ifNoneMatch(new Request("http://x", { headers: { "if-none-match": tag } }), tag), true);
  assert.equal(ifNoneMatch(new Request("http://x", { headers: { "if-none-match": '"other"' } }), tag), false);
  assert.equal(ifNoneMatch(new Request("http://x", { headers: { "if-none-match": "*" } }), tag), true);
  assert.equal(ifNoneMatch(new Request("http://x"), tag), false);
});

test("jsonWithETag: 200 with body first, 304 when the client already has it", async () => {
  const body = JSON.stringify({ hello: "world" });
  const first = jsonWithETag(new Request("http://x"), body, { "x-ratelimit-remaining": "9" });
  assert.equal(first.status, 200);
  assert.equal(await first.text(), body);
  const etag = first.headers.get("etag")!;
  assert.ok(etag);
  assert.equal(first.headers.get("x-ratelimit-remaining"), "9", "extra headers ride along");

  const second = jsonWithETag(new Request("http://x", { headers: { "if-none-match": etag } }), body);
  assert.equal(second.status, 304);
  assert.equal(await second.text(), "", "304 carries no body");
  assert.equal(second.headers.get("etag"), etag);
});
