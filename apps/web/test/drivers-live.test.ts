import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeDriverTree, DRIVER_SOURCES } from "../lib/drivers";
import { liveAcquisitionMetrics } from "../lib/acquisition/live-metrics";
import { uid } from "./helpers/pg";

test("sanitizeDriverTree keeps a valid live source and drops an invalid one", () => {
  const t = sanitizeDriverTree({
    outcomeLabel: "Revenue", outcomeTarget: "$50k",
    drivers: [
      { label: "Leads", current: "10", target: "40", note: "", source: "leads_7d" },
      { label: "Bogus", current: "1", target: "2", note: "", source: "not_a_metric" },
      { label: "Manual", current: "3", target: "5", note: "" },
    ],
  });
  assert.equal(t.drivers[0]!.source, "leads_7d", "valid source kept");
  assert.equal(t.drivers[1]!.source, undefined, "invalid source dropped");
  assert.equal(t.drivers[2]!.source, undefined, "no source stays unset");
});

test("liveAcquisitionMetrics exposes exactly the linkable DRIVER_SOURCES", async () => {
  // An empty workspace yields all metrics at zero, but the KEYS must line up
  // with what a driver can link to — otherwise a link would never resolve.
  const metrics = await liveAcquisitionMetrics(uid("drv-live-ws"));
  const metricKeys = metrics.map((m) => m.key).sort();
  assert.deepEqual(metricKeys, [...DRIVER_SOURCES].sort(), "every DRIVER_SOURCES key has a live metric and vice versa");
  for (const m of metrics) {
    assert.equal(typeof m.display, "string");
    assert.ok(m.label.length > 0);
  }
});
