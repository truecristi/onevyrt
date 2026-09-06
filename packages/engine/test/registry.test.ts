import test from "node:test";
import assert from "node:assert/strict";
import { NODE_REGISTRY, capabilityOf, fieldsFor, allKinds } from "../src/registry.ts";

test("registry: covers exactly the four node kinds", () => {
  assert.deepEqual(allKinds().sort(), ["offer", "split", "step", "traffic"]);
});

test("registry: every field is well-formed (key, label, valid unit)", () => {
  const units = new Set(["count", "rate", "money"]);
  for (const cap of Object.values(NODE_REGISTRY)) {
    assert.ok(cap.label && cap.color.startsWith("#"), `${cap.kind} needs label+colour`);
    for (const f of cap.fields) {
      assert.ok(f.key && f.label, `${cap.kind} field needs key+label`);
      assert.ok(units.has(f.unit), `${cap.kind}.${f.key} bad unit ${f.unit}`);
    }
  }
});

test("registry: capability flags match node roles", () => {
  assert.equal(capabilityOf("traffic")!.can.emitTraffic, true);
  assert.equal(capabilityOf("offer")!.can.charge, true);
  assert.equal(capabilityOf("offer")!.can.convert, true);
  assert.equal(capabilityOf("offer")!.can.recur, true);
  assert.equal(capabilityOf("split")!.can.split, true);
  assert.equal(capabilityOf("step")!.can.charge, false);
});

test("registry: offer now exposes churn as an editable field (solvable/scenario-able)", () => {
  const keys = fieldsFor("offer").map((f) => f.key);
  assert.ok(keys.includes("churnRate"), "churnRate must be a first-class offer field");
  assert.ok(keys.includes("price") && keys.includes("conversionRate"));
});

test("registry: unknown kind yields no fields, no throw", () => {
  assert.deepEqual(fieldsFor("nope"), []);
  assert.equal(capabilityOf("nope"), undefined);
});
