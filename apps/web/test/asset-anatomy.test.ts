import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_TYPES, getAssetType, requiredSections } from "../lib/asset-anatomy";

test("asset types: expected set exists with unique ids", () => {
  const ids = ASSET_TYPES.map((a) => a.id);
  for (const id of ["email", "landing", "ad", "sms"]) {
    assert.ok(ids.includes(id as (typeof ids)[number]), `missing asset type ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length);
});

test("every section has purpose, guidance and an example; keys unique per type", () => {
  for (const a of ASSET_TYPES) {
    assert.ok(a.sections.length > 0, `${a.id} has no sections`);
    const keys = a.sections.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, `${a.id} has duplicate section keys`);
    for (const s of a.sections) {
      assert.ok(s.name && s.purpose && s.guidance && s.example, `${a.id}.${s.key} is missing a field`);
    }
  }
});

test("email follows the hook -> story -> offer -> CTA spine", () => {
  const email = getAssetType("email")!;
  const keys = email.sections.map((s) => s.key);
  for (const k of ["subject", "hook", "story", "offer", "cta"]) {
    assert.ok(keys.includes(k), `email missing section ${k}`);
  }
  // spine order: hook before story before offer before cta
  assert.ok(keys.indexOf("hook") < keys.indexOf("story"));
  assert.ok(keys.indexOf("story") < keys.indexOf("offer"));
  assert.ok(keys.indexOf("offer") < keys.indexOf("cta"));
});

test("landing page has the core conversion sections", () => {
  const keys = getAssetType("landing")!.sections.map((s) => s.key);
  for (const k of ["hero", "problem", "solution", "proof", "offer", "objections", "finalCta"]) {
    assert.ok(keys.includes(k), `landing missing section ${k}`);
  }
});

test("requiredSections drops optional ones and keeps order", () => {
  const req = requiredSections("email");
  assert.ok(!req.some((s) => s.optional), "required set must contain no optional sections");
  assert.ok(req.some((s) => s.key === "hook"));
  assert.ok(!req.some((s) => s.key === "ps"), "P.S. is optional and should be excluded");
});

test("getAssetType returns undefined for unknown ids", () => {
  assert.equal(getAssetType("nope"), undefined);
});
