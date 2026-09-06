import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_TEMPLATES, templatesForType } from "../lib/asset-templates";
import { getAssetType, type AssetTypeId } from "../lib/asset-anatomy";

test("asset templates: ids are unique", () => {
  const ids = ASSET_TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate asset-template id");
});

test("asset templates: every value key is a real section of its asset type", () => {
  for (const t of ASSET_TEMPLATES) {
    const type = getAssetType(t.type);
    assert.ok(type, `${t.id} has unknown type ${t.type}`);
    const keys = new Set(type!.sections.map((s) => s.key));
    for (const k of Object.keys(t.values)) {
      assert.ok(keys.has(k), `${t.id}: value key "${k}" is not a section of ${t.type}`);
      assert.ok(t.values[k]!.trim().length > 0, `${t.id}: value "${k}" is empty`);
    }
  }
});

test("asset templates: every required section of the type is filled", () => {
  for (const t of ASSET_TEMPLATES) {
    const required = getAssetType(t.type)!.sections.filter((s) => !s.optional).map((s) => s.key);
    for (const k of required) {
      assert.ok(k in t.values, `${t.id} is missing required section "${k}"`);
    }
  }
});

test("templatesForType returns only that type, and each type has at least one", () => {
  for (const type of ["email", "landing", "ad", "sms"] as AssetTypeId[]) {
    const list = templatesForType(type);
    assert.ok(list.length >= 1, `no templates for ${type}`);
    assert.ok(list.every((t) => t.type === type));
  }
});
