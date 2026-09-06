import test from "node:test";
import assert from "node:assert/strict";
import {
  serializeDoc, deserializeDoc, emptyDoc, PersistError,
  DOC_VERSION, type FunnelDoc,
} from "../src/persist.ts";

const sample: FunnelDoc = {
  version: DOC_VERSION,
  name: "Webinar funnel",
  currency: "USD",
  nodes: [
    { id: "fb", kind: "traffic", label: "Facebook Ads", x: 40, y: 140, visitors: 1000, costPerVisitor: 200 },
    { id: "lp", kind: "step", label: "Landing", x: 300, y: 140, passRate: 0.4 },
    { id: "sale", kind: "offer", label: "Core Offer", x: 560, y: 140, conversionRate: 0.1, price: 9700 },
  ],
  edges: [
    { id: "e-fb-lp", source: "fb", target: "lp", sourceHandle: null },
    { id: "e-lp-sale", source: "lp", target: "sale", sourceHandle: null },
  ],
  actuals: { fb: { visitors: 950, cost: 210000 }, sale: { buyers: 31, revenue: 300000 } },
  decisions: [
    { id: "d1", createdAt: "2026-01-01T00:00:00.000Z", problem: "Low conv", hypothesis: "Price too high",
      move: "Drop price 10%", reason: "test", expectedImpact: "+5 buyers", confidence: "medium",
      owner: "me", dueDate: "2026-02-01", status: "open" },
  ],
};

test("round-trip is lossless", () => {
  const back = deserializeDoc(serializeDoc(sample));
  assert.deepEqual(back, sample);
});

test("serialize always stamps the current version", () => {
  const doc = { ...sample, version: 999 };
  const back = deserializeDoc(serializeDoc(doc));
  assert.equal(back.version, DOC_VERSION);
});

test("riskRegister round-trips, and malformed entries are dropped", () => {
  const withRisk: FunnelDoc = {
    ...sample,
    riskRegister: [
      { id: "r1", createdAt: "2026-01-01T00:00:00.000Z", label: "Thin margin", description: "Margin under 10%", severity: "high", status: "open", owner: "me" },
    ],
  };
  const back = deserializeDoc(serializeDoc(withRisk));
  assert.equal(back.riskRegister?.length, 1);
  assert.equal(back.riskRegister?.[0].label, "Thin margin");
  assert.equal(back.riskRegister?.[0].owner, "me");

  const bad = JSON.stringify({ ...emptyDoc(), riskRegister: [{ id: "x" }, { id: "y", label: "ok", severity: "nonsense", status: "open" }] });
  assert.equal(deserializeDoc(bad).riskRegister, undefined);
});

test("decisions round-trips with a measurement, and malformed entries are dropped", () => {
  const withMeasured: FunnelDoc = {
    ...sample,
    decisions: [
      ...sample.decisions,
      { id: "d2", createdAt: "2026-01-01T00:00:00.000Z", problem: "p", hypothesis: "h", move: "m", reason: "r",
        expectedImpact: "e", confidence: "high", owner: "me", dueDate: "2026-02-01", status: "measured",
        linkedNodeId: "sale",
        measurement: { baseline: 10, expected: 15, observed: 16, outcome: "hit", learning: "worked", measuredAt: "2026-02-15T00:00:00.000Z" } },
    ],
  };
  const back = deserializeDoc(serializeDoc(withMeasured));
  assert.equal(back.decisions.length, 2);
  assert.equal(back.decisions[1].linkedNodeId, "sale");
  assert.equal(back.decisions[1].measurement?.outcome, "hit");

  const bad = JSON.stringify({
    ...emptyDoc(),
    decisions: [
      { id: "x" }, // missing problem/hypothesis/move/confidence/status entirely
      { id: "y", problem: "p", hypothesis: "h", move: "m", confidence: "nonsense", status: "open" }, // bad confidence
      { id: "z", problem: "p", hypothesis: "h", move: "m", confidence: "low", status: "not-a-status" }, // bad status
      { problem: "p", hypothesis: "h", move: "m", confidence: "low", status: "open" }, // missing id
    ],
  });
  assert.equal(deserializeDoc(bad).decisions.length, 0);
});

test("goals round-trips the full hierarchy, drops malformed entries, and clears dangling parentIds", () => {
  const withGoals: FunnelDoc = {
    ...sample,
    goals: [
      { id: "vision", level: "vision", title: "Work 25 hrs/week, $2M/yr", status: "on_track", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "annual", level: "annual", parentId: "vision", title: "Hire an ops lead", status: "at_risk", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "kpi", level: "monthly_kpi", parentId: "annual", title: "40 leads/mo", status: "not_started",
        targetValue: 40, actualValue: 12, unit: "leads", dueDate: "2026-03-01", linkedNodeId: "sale", createdAt: "2026-01-01T00:00:00.000Z" },
    ],
  };
  const back = deserializeDoc(serializeDoc(withGoals));
  assert.equal(back.goals?.length, 3);
  assert.equal(back.goals?.[1].parentId, "vision");
  assert.equal(back.goals?.[2].targetValue, 40);
  assert.equal(back.goals?.[2].linkedNodeId, "sale");

  const bad = JSON.stringify({
    ...emptyDoc(),
    goals: [
      { id: "x" }, // missing level/title/status entirely
      { id: "y", level: "nonsense", title: "t", status: "on_track" }, // bad level
      { id: "z", level: "action", title: "t", status: "not-a-status" }, // bad status
      { level: "action", title: "t", status: "on_track" }, // missing id
      { id: "dup", level: "action", title: "first", status: "on_track" },
      { id: "dup", level: "action", title: "second (duplicate id, dropped)", status: "on_track" },
      { id: "orphan", level: "action", title: "parent doesn't exist", status: "on_track", parentId: "nonexistent" },
    ],
  });
  const parsed = deserializeDoc(bad);
  assert.equal(parsed.goals?.length, 2, "only the first 'dup' and the orphan should survive");
  const orphan = parsed.goals?.find((g) => g.id === "orphan");
  assert.equal(orphan?.parentId, undefined, "a parentId pointing nowhere must be dropped, not left dangling");
});

test("assumptions round-trip, and malformed entries are dropped", () => {
  const withAssumptions: FunnelDoc = {
    ...sample,
    assumptions: [
      { id: "a1", text: "40% of leads will book a call", confidence: "high", status: "untested", createdAt: "2026-01-01T00:00:00.000Z",
        category: "sales", owner: "me", testByDate: "2026-03-01", linkedNodeId: "sale" },
    ],
  };
  const back = deserializeDoc(serializeDoc(withAssumptions));
  assert.equal(back.assumptions?.length, 1);
  assert.equal(back.assumptions?.[0].category, "sales");
  assert.equal(back.assumptions?.[0].linkedNodeId, "sale");

  const bad = JSON.stringify({
    ...emptyDoc(),
    assumptions: [
      { id: "x" }, // missing text/confidence/status
      { id: "y", text: "t", confidence: "nonsense", status: "untested" }, // bad confidence
      { id: "z", text: "t", confidence: "low", status: "not-a-status" }, // bad status
      { text: "t", confidence: "low", status: "untested" }, // missing id
    ],
  });
  assert.equal(deserializeDoc(bad).assumptions?.length ?? 0, 0);
});

test("experiments round-trip, link to a real assumption, and malformed entries (including a dangling linkedAssumptionId) are handled", () => {
  const withExperiments: FunnelDoc = {
    ...sample,
    assumptions: [
      { id: "a1", text: "40% of leads will book a call", confidence: "high", status: "testing", createdAt: "2026-01-01T00:00:00.000Z" },
    ],
    experiments: [
      { id: "e1", hypothesis: "A shorter form increases booking rate", status: "completed", createdAt: "2026-01-01T00:00:00.000Z",
        metric: "booking rate", baseline: "32%", sampleSize: 200, successThreshold: ">40% book", testDesign: "A/B, 50/50 split",
        audience: "cold traffic from the ad funnel", owner: "Priya", cost: 5000, result: "44% booked", confidence: "high",
        decision: "adopt", learning: "shorter forms beat long ones for cold traffic", linkedAssumptionId: "a1" },
    ],
  };
  const back = deserializeDoc(serializeDoc(withExperiments));
  assert.equal(back.experiments?.length, 1);
  assert.equal(back.experiments?.[0].linkedAssumptionId, "a1");
  assert.equal(back.experiments?.[0].decision, "adopt");
  assert.equal(back.experiments?.[0].metric, "booking rate");
  assert.equal(back.experiments?.[0].baseline, "32%");
  assert.equal(back.experiments?.[0].testDesign, "A/B, 50/50 split");
  assert.equal(back.experiments?.[0].audience, "cold traffic from the ad funnel");
  assert.equal(back.experiments?.[0].owner, "Priya");
  assert.equal(back.experiments?.[0].confidence, "high");
  assert.equal(back.experiments?.[0].learning, "shorter forms beat long ones for cold traffic");

  const bad = JSON.stringify({
    ...emptyDoc(),
    experiments: [
      { id: "x" }, // missing hypothesis/status
      { id: "y", hypothesis: "h", status: "not-a-status" }, // bad status
      { hypothesis: "h", status: "planned" }, // missing id
      { id: "z", hypothesis: "h", status: "planned", linkedAssumptionId: "nonexistent", confidence: "extreme" }, // dangling assumption link + bad confidence
    ],
  });
  const parsed = deserializeDoc(bad);
  assert.equal(parsed.experiments?.length, 1, "only 'z' should survive");
  assert.equal(parsed.experiments?.[0].linkedAssumptionId, undefined, "a link to a nonexistent assumption must be dropped");
  assert.equal(parsed.experiments?.[0].confidence, undefined, "an out-of-range confidence value must be dropped, not passed through");
});

test("experiments: legacy 'reject' decision still reads correctly, and follow-up links are validated like assumption links", () => {
  const legacy = JSON.stringify({
    ...emptyDoc(),
    experiments: [
      { id: "e1", hypothesis: "old data with the pre-rename decision value", status: "completed", createdAt: "2026-01-01T00:00:00.000Z", decision: "reject" },
      { id: "e2", hypothesis: "spawns a real follow-up", status: "completed", createdAt: "2026-01-01T00:00:00.000Z", decision: "retest", followUpExperimentId: "e3" },
      { id: "e3", hypothesis: "the follow-up itself", status: "planned", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "e4", hypothesis: "points at a follow-up that doesn't exist", status: "completed", createdAt: "2026-01-01T00:00:00.000Z", decision: "retest", followUpExperimentId: "nonexistent" },
      { id: "e5", hypothesis: "points at itself", status: "completed", createdAt: "2026-01-01T00:00:00.000Z", decision: "retest", followUpExperimentId: "e5" },
    ],
  });
  const parsed = deserializeDoc(legacy);
  assert.equal(parsed.experiments?.find((e) => e.id === "e1")?.decision, "reject", "old 'reject' values must still round-trip, not be silently dropped");
  assert.equal(parsed.experiments?.find((e) => e.id === "e2")?.followUpExperimentId, "e3", "a follow-up link to a real sibling experiment must survive");
  assert.equal(parsed.experiments?.find((e) => e.id === "e4")?.followUpExperimentId, undefined, "a follow-up link to a nonexistent experiment must be dropped");
  assert.equal(parsed.experiments?.find((e) => e.id === "e5")?.followUpExperimentId, undefined, "an experiment cannot be its own follow-up");
});

test("money machine targets and ledger round-trip, and malformed entries are dropped", () => {
  const withMoneyMachine: FunnelDoc = {
    ...sample,
    moneyMachineTargets: { securityTarget: 5000000, growthTarget: 2000000, dreamTarget: 1000000, securityGoalDate: "2027-06-01" },
    moneyMachineLedger: [
      { id: "l1", createdAt: "2026-01-01T00:00:00.000Z", bucket: "security", kind: "contribution", amount: 50000, note: "January set-aside" },
      { id: "l2", createdAt: "2026-02-01T00:00:00.000Z", bucket: "dream", kind: "withdrawal", amount: 10000 },
    ],
  };
  const back = deserializeDoc(serializeDoc(withMoneyMachine));
  assert.equal(back.moneyMachineTargets?.securityTarget, 5000000);
  assert.equal(back.moneyMachineTargets?.securityGoalDate, "2027-06-01");
  assert.equal(back.moneyMachineTargets?.growthGoalDate, undefined, "a goal date must not be invented for a bucket that never had one");
  assert.equal(back.moneyMachineLedger?.length, 2);
  assert.equal(back.moneyMachineLedger?.[0].note, "January set-aside");
  assert.equal(back.moneyMachineLedger?.[1].kind, "withdrawal");

  const bad = JSON.stringify({
    ...emptyDoc(),
    moneyMachineTargets: { securityTarget: -5, growthTarget: "nope", dreamGoalDate: "not-a-real-date" }, // negative, wrong type, and unparseable date all dropped
    moneyMachineLedger: [
      { id: "x" }, // missing bucket/kind/amount
      { id: "y", bucket: "nonsense", kind: "contribution", amount: 100 }, // bad bucket
      { id: "z", bucket: "security", kind: "not-a-kind", amount: 100 }, // bad kind
      { id: "w", bucket: "security", kind: "contribution", amount: -100 }, // negative amount
      { bucket: "security", kind: "contribution", amount: 100 }, // missing id
    ],
  });
  const parsed = deserializeDoc(bad);
  assert.equal(parsed.moneyMachineTargets, undefined, "all-invalid targets object should collapse to undefined");
  assert.equal(parsed.moneyMachineLedger?.length ?? 0, 0);
});

test("checklist round-trips, and malformed entries are dropped", () => {
  const withChecklist: FunnelDoc = {
    ...sample,
    checklist: [
      { id: "c1", text: "Tracking installed", done: true, createdAt: "2026-01-01T00:00:00.000Z", doneAt: "2026-01-02T00:00:00.000Z" },
      { id: "c2", text: "Checkout tested", done: false, createdAt: "2026-01-01T00:00:00.000Z", linkedNodeId: "sale" },
    ],
  };
  const back = deserializeDoc(serializeDoc(withChecklist));
  assert.equal(back.checklist?.length, 2);
  assert.equal(back.checklist?.[0].done, true);
  assert.equal(back.checklist?.[0].doneAt, "2026-01-02T00:00:00.000Z");
  assert.equal(back.checklist?.[1].linkedNodeId, "sale");

  const bad = JSON.stringify({ ...emptyDoc(), checklist: [{ id: "x" }, { text: "no id" }] });
  assert.equal(deserializeDoc(bad).checklist, undefined);
});

test("checklist sub-items (parentId) round-trip", () => {
  const withSub: FunnelDoc = {
    ...sample,
    checklist: [
      { id: "c1", text: "Tracking installed", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "c2", text: "GA4 pixel verified", done: true, createdAt: "2026-01-01T00:00:00.000Z", parentId: "c1" },
    ],
  };
  const back = deserializeDoc(serializeDoc(withSub));
  assert.equal(back.checklist?.[1].parentId, "c1");
});

test("notes round-trips, and empty/oversized notes are dropped", () => {
  const withNotes: FunnelDoc = { ...sample, notes: "Q1 strategy: push webinar funnel, cut cold traffic spend." };
  const back = deserializeDoc(serializeDoc(withNotes));
  assert.equal(back.notes, withNotes.notes);

  assert.equal(deserializeDoc(JSON.stringify({ ...emptyDoc(), notes: "" })).notes, undefined);
  assert.equal(deserializeDoc(JSON.stringify({ ...emptyDoc(), notes: "x".repeat(20001) })).notes, undefined);
});

test("program round-trips, and malformed entries are dropped", () => {
  const withProgram: FunnelDoc = {
    ...sample,
    program: {
      definition: { businessName: "Acme", breakthrough: "Stop chasing cold leads" },
      forceActions: [
        { id: "f1", force: 4, principle: "Follow up close rate", actionItem: "Add a 3-touch follow-up sequence",
          dollarValue: 500000, deadline: "2026-03-01", owner: "me", status: "open", priority: "high",
          confidence: "high", linkedNodeId: "sale", linkedKpi: "revenue", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
    },
  };
  const back = deserializeDoc(serializeDoc(withProgram));
  assert.equal(back.program?.definition?.businessName, "Acme");
  assert.equal(back.program?.forceActions?.length, 1);
  assert.equal(back.program?.forceActions?.[0].dollarValue, 500000);
  assert.equal(back.program?.forceActions?.[0].confidence, "high");
  assert.equal(back.program?.forceActions?.[0].linkedNodeId, "sale");
  assert.equal(back.program?.forceActions?.[0].linkedKpi, "revenue");

  const bad = JSON.stringify({ ...emptyDoc(), program: { forceActions: [{ id: "x" }, { id: "y", force: 9, principle: "p", actionItem: "a", status: "open", priority: "low" }] } });
  assert.equal(deserializeDoc(bad).program, undefined);
});

test("program: a linkedNodeId that doesn't exist on the doc is dropped, not stored dangling", () => {
  const doc = JSON.stringify({
    ...sample,
    program: { forceActions: [{ id: "f2", force: 1, principle: "p", actionItem: "a", status: "open", priority: "low", linkedNodeId: "does-not-exist", createdAt: "2026-01-01T00:00:00.000Z" }] },
  });
  const back = deserializeDoc(doc);
  assert.equal(back.program?.forceActions?.[0].linkedNodeId, undefined);
});

test("moneyMachine round-trips, and out-of-range rates are dropped", () => {
  const withMM: FunnelDoc = { ...sample, moneyMachine: { freedomFundRate: 0.15, securityRate: 0.5, growthRate: 0.3, dreamRate: 0.2 } };
  const back = deserializeDoc(serializeDoc(withMM));
  assert.deepEqual(back.moneyMachine, withMM.moneyMachine);

  const bad = JSON.stringify({ ...emptyDoc(), moneyMachine: { freedomFundRate: 1.5, securityRate: 0.5, growthRate: 0.3, dreamRate: 0.2 } });
  assert.equal(deserializeDoc(bad).moneyMachine, undefined);
});

test("objections and hooks round-trip, and malformed entries are dropped", () => {
  const withPlaybook: FunnelDoc = {
    ...sample,
    objections: [{ id: "o1", objection: "It's too expensive", response: "Compare to the cost of staying stuck", createdAt: "2026-01-01T00:00:00.000Z" }],
    hooks: [{ id: "h1", hook: "The $497 launch that outsold their $2,000 program", angle: "proof", createdAt: "2026-01-01T00:00:00.000Z" }],
  };
  const back = deserializeDoc(serializeDoc(withPlaybook));
  assert.equal(back.objections?.[0].response, "Compare to the cost of staying stuck");
  assert.equal(back.hooks?.[0].angle, "proof");

  const bad = JSON.stringify({ ...emptyDoc(), objections: [{ id: "x" }], hooks: [{ id: "y" }] });
  assert.equal(deserializeDoc(bad).objections, undefined);
  assert.equal(deserializeDoc(bad).hooks, undefined);
});

test("profitDrivers round-trips, and out-of-range percentages are dropped", () => {
  const withDrivers: FunnelDoc = { ...sample, profitDrivers: { leadsPct: 0.1, salesProcessPct: 0.05, conversionPct: 0.2, transactionValuePct: 0, retentionPct: 0.1 } };
  const back = deserializeDoc(serializeDoc(withDrivers));
  assert.deepEqual(back.profitDrivers, withDrivers.profitDrivers);

  const bad = JSON.stringify({ ...emptyDoc(), profitDrivers: { leadsPct: -5, salesProcessPct: 0, conversionPct: 0, transactionValuePct: 0, retentionPct: 0 } });
  assert.equal(deserializeDoc(bad).profitDrivers, undefined);
});

test("clientPromises and ravingFans round-trip, and malformed entries are dropped", () => {
  const withRaving: FunnelDoc = {
    ...sample,
    clientPromises: [{ id: "cp1", promise: "Reply within 24h", delivered: true, createdAt: "2026-01-01T00:00:00.000Z" }],
    ravingFans: { retentionRate: 0.7, referralRate: 0.3 },
  };
  const back = deserializeDoc(serializeDoc(withRaving));
  assert.equal(back.clientPromises?.[0].delivered, true);
  assert.deepEqual(back.ravingFans, withRaving.ravingFans);

  const bad = JSON.stringify({ ...emptyDoc(), clientPromises: [{ id: "x" }], ravingFans: { retentionRate: 2, referralRate: 0.3 } });
  assert.equal(deserializeDoc(bad).clientPromises, undefined);
  assert.equal(deserializeDoc(bad).ravingFans, undefined);
});

test("retargetingLoops round-trip, and loops referencing unknown nodes are dropped", () => {
  const withLoop: FunnelDoc = {
    ...sample,
    retargetingLoops: [{ id: "l1", fromNodeId: "lp", fromPort: "no" as const, toNodeId: "fb", decayRate: 0.35 }],
  };
  const back = deserializeDoc(serializeDoc(withLoop));
  assert.equal(back.retargetingLoops?.length, 1);
  assert.equal(back.retargetingLoops?.[0].decayRate, 0.35);

  const bad = JSON.stringify({ ...emptyDoc(), retargetingLoops: [{ id: "x", fromNodeId: "nope", fromPort: "no", toNodeId: "also-nope", decayRate: 0.5 }] });
  assert.equal(deserializeDoc(bad).retargetingLoops, undefined);
});

test("delayDays round-trips on a node", () => {
  const withDelay: FunnelDoc = { ...sample, nodes: [sample.nodes[0], { ...sample.nodes[1], delayDays: 3 }, sample.nodes[2]] };
  const back = deserializeDoc(serializeDoc(withDelay));
  assert.equal(back.nodes[1].delayDays, 3);
  assert.equal(back.nodes[0].delayDays, undefined);
});

test("edge label round-trips, and blank/oversized labels are dropped", () => {
  const withLabel: FunnelDoc = { ...sample, edges: [{ ...sample.edges[0], label: "20% off" }, sample.edges[1]] };
  const back = deserializeDoc(serializeDoc(withLabel));
  assert.equal(back.edges[0].label, "20% off");
  assert.equal(back.edges[1].label, undefined);

  const oversized = JSON.stringify({ ...emptyDoc(), edges: [{ id: "e1", source: "a", target: "b", label: "x".repeat(81) }] });
  assert.equal(deserializeDoc(oversized).edges[0].label, undefined);
});

test("emptyDoc is a valid, round-trippable document", () => {
  const e = emptyDoc("New");
  assert.deepEqual(deserializeDoc(serializeDoc(e)), e);
});

test("invalid JSON throws PersistError", () => {
  assert.throws(() => deserializeDoc("{not json"), PersistError);
});

test("unknown node kind is rejected", () => {
  const bad = JSON.stringify({ nodes: [{ id: "x", kind: "wormhole" }], edges: [] });
  assert.throws(() => deserializeDoc(bad), /unknown kind/);
});

test("missing nodes/edges arrays are rejected", () => {
  assert.throws(() => deserializeDoc(JSON.stringify({ edges: [] })), /nodes array/);
  assert.throws(() => deserializeDoc(JSON.stringify({ nodes: [] })), /edges array/);
});

test("non-finite numbers are dropped, not persisted as NaN", () => {
  const bad = JSON.stringify({ nodes: [{ id: "a", kind: "traffic", visitors: null }], edges: [] });
  const doc = deserializeDoc(bad);
  assert.equal(doc.nodes[0].visitors, undefined);
});

test("currency: round-trips through serialize/deserialize", () => {
  const doc = { ...emptyDoc("EUR funnel"), currency: "EUR" };
  const back = deserializeDoc(serializeDoc(doc));
  assert.equal(back.currency, "EUR");
});

test("currency: legacy docs without a currency default to USD", () => {
  const legacy = JSON.stringify({ version: DOC_VERSION, name: "old", nodes: [], edges: [], actuals: {}, decisions: [] });
  assert.equal(deserializeDoc(legacy).currency, "USD");
});

test("currency: emptyDoc defaults to USD", () => {
  assert.equal(emptyDoc().currency, "USD");
});

test("persist: block width (w) survives the round-trip and is optional", () => {
  const d = emptyDoc("Sized");
  d.nodes = [
    { id: "a", kind: "traffic", label: "FB", x: 0, y: 0, visitors: 100, costPerVisitor: 200, w: 240 },
    { id: "b", kind: "step", label: "LP", x: 10, y: 10, passRate: 0.4 },
  ];
  const back = deserializeDoc(serializeDoc(d));
  assert.equal(back.nodes[0].w, 240);
  assert.equal(back.nodes[1].w, undefined);
});

test("persist: brand key survives the round-trip; junk is dropped", () => {
  const d = emptyDoc("Branded");
  d.nodes = [
    { id: "a", kind: "traffic", label: "Paid social", x: 0, y: 0, visitors: 100, costPerVisitor: 200, brand: "facebook" },
    { id: "b", kind: "traffic", label: "No brand", x: 5, y: 5, visitors: 10, costPerVisitor: 10 },
    { id: "c", kind: "traffic", label: "Bad brand", x: 9, y: 9, visitors: 10, costPerVisitor: 10, brand: 42 as unknown as string },
  ];
  const back = deserializeDoc(serializeDoc(d));
  assert.equal(back.nodes[0].brand, "facebook");
  assert.equal(back.nodes[1].brand, undefined);
  assert.equal(back.nodes[2].brand, undefined);
});

test("persist: ui blob keeps primitives, drops nested/functions, survives round-trip", () => {
  const d = emptyDoc("UI");
  d.nodes = [{
    id: "a", kind: "offer", label: "Core", x: 0, y: 0, price: 9700, conversionRate: 0.1,
    ui: { notes: "call before close", showNo: true, theme: "indigo", pad: 3,
          nested: { a: 1 } as unknown as string, arr: [1, 2] as unknown as string },
  }];
  const back = deserializeDoc(serializeDoc(d));
  const ui = back.nodes[0].ui!;
  assert.equal(ui.notes, "call before close");
  assert.equal(ui.showNo, true);
  assert.equal(ui.theme, "indigo");
  assert.equal(ui.pad, 3);
  assert.equal(ui.nested, undefined);
  assert.equal(ui.arr, undefined);
});

test("persist: scenario expenses survive the round-trip and are validated", () => {
  const d = emptyDoc("Exp");
  d.expenses = { amount: 250000, rate: 0.04 };
  const back = deserializeDoc(serializeDoc(d));
  assert.deepEqual(back.expenses, { amount: 250000, rate: 0.04 });

  // junk is rejected rather than trusted
  const bad = JSON.parse(serializeDoc(emptyDoc("Bad"))) as Record<string, unknown>;
  bad.expenses = { amount: -5, rate: 9 };
  assert.equal(deserializeDoc(JSON.stringify(bad)).expenses, undefined);
});

test("persist: archived flag survives the round-trip; absent means active", () => {
  const d = emptyDoc("Arch");
  d.archived = true;
  assert.equal(deserializeDoc(serializeDoc(d)).archived, true);
  assert.equal(deserializeDoc(serializeDoc(emptyDoc("Live"))).archived, undefined);
});

test("persist: cost model + flat cost survive the round-trip; junk model is dropped", () => {
  const d = emptyDoc("Cost");
  d.nodes = [
    { id: "a", kind: "traffic", label: "Ads", x: 0, y: 0, visitors: 1000, costPerVisitor: 200, costModel: "flat", flatCost: 300000 },
    { id: "b", kind: "traffic", label: "Organic", x: 1, y: 1, visitors: 10, costPerVisitor: 0, costModel: "nonsense" as unknown as "flat" },
  ];
  const back = deserializeDoc(serializeDoc(d));
  assert.equal(back.nodes[0].costModel, "flat");
  assert.equal(back.nodes[0].flatCost, 300000);
  assert.equal(back.nodes[1].costModel, undefined);
});

test("persist: variants survive the round-trip; malformed ones are dropped", () => {
  const d = emptyDoc("Ladder");
  d.nodes = [{
    id: "o", kind: "offer", label: "Offer", x: 0, y: 0, conversionRate: 0.1, price: 10000,
    variants: [
      { id: "basic", name: "Basic", sku: "SKU-1", price: 5000, share: 0.7, unitCost: 500, active: false },
      { id: "pro", price: 20000, share: 0.3 },
      { id: "", price: 1, share: 1 } as never,          // no id
      { id: "bad", price: -5, share: 1 } as never,      // negative price
      { id: "worse", price: 100, share: 9 } as never,   // share out of range
    ],
  }];
  const back = deserializeDoc(serializeDoc(d));
  const vs = back.nodes[0].variants!;
  assert.equal(vs.length, 2);
  assert.equal(vs[0].id, "basic");
  assert.equal(vs[0].name, "Basic");
  assert.equal(vs[0].sku, "SKU-1");
  assert.equal(vs[0].unitCost, 500);
  assert.equal(vs[0].active, false);
  assert.equal(vs[1].id, "pro");
  assert.equal(vs[1].active, undefined);
});

test("persist: period survives the round-trip; nonsense is dropped", () => {
  const d = emptyDoc("Period");
  d.period = { start: "2026-07-01", end: "2026-07-31" };
  assert.deepEqual(deserializeDoc(serializeDoc(d)).period, { start: "2026-07-01", end: "2026-07-31" });

  const bad = JSON.parse(serializeDoc(emptyDoc("Bad"))) as Record<string, unknown>;
  bad.period = { start: "2026-07-31", end: "2026-07-01" };   // reversed
  assert.equal(deserializeDoc(JSON.stringify(bad)).period, undefined);
  bad.period = { start: "2026-02-31", end: "2026-03-01" };   // impossible day
  assert.equal(deserializeDoc(JSON.stringify(bad)).period, undefined);
});

test("persist: edge lineType survives the round-trip; absent means primary; garbage is dropped", () => {
  const d = emptyDoc("Lines");
  d.nodes = [
    { id: "a", kind: "traffic", label: "A", x: 0, y: 0, visitors: 100, costPerVisitor: 10 },
    { id: "b", kind: "step", label: "B", x: 200, y: 0, passRate: 0.5 },
    { id: "c", kind: "step", label: "C", x: 400, y: 0, passRate: 0.5 },
  ];
  d.edges = [
    { id: "e-a-b", source: "a", target: "b", lineType: "secondary" },
    { id: "e-b-c", source: "b", target: "c", lineType: "conditional" },
  ];
  const back = deserializeDoc(serializeDoc(d));
  assert.equal(back.edges[0].lineType, "secondary");
  assert.equal(back.edges[1].lineType, "conditional");

  const bad = JSON.parse(serializeDoc(d)) as { edges: Array<Record<string, unknown>> };
  bad.edges[0].lineType = "diagonal"; // not a real EdgeLineType
  const backBad = deserializeDoc(JSON.stringify(bad));
  assert.equal(backBad.edges[0].lineType, undefined);
});

test("persist: annotations survive the round-trip; malformed ones are dropped", () => {
  const d = emptyDoc("Notes");
  d.annotations = [
    { id: "a1", kind: "sticky", x: 10, y: 20, w: 160, h: 90, text: "Ask about pricing", color: "#fde68a" },
    { id: "a2", kind: "text", x: 300, y: 40, w: 200, h: 30, text: "Phase 2" },
  ];
  const back = deserializeDoc(serializeDoc(d));
  assert.equal(back.annotations!.length, 2);
  assert.equal(back.annotations![0].text, "Ask about pricing");
  assert.equal(back.annotations![0].color, "#fde68a");
  assert.equal(back.annotations![1].kind, "text");

  const bad = JSON.parse(serializeDoc(d)) as { annotations: Array<Record<string, unknown>> };
  bad.annotations.push({ id: "a3", kind: "circle", x: 0, y: 0, w: 10, h: 10 }); // bad kind
  bad.annotations.push({ id: "a4", kind: "text", x: 0, y: 0, w: -5, h: 10 });   // bad size
  bad.annotations.push({ id: "", kind: "text", x: 0, y: 0, w: 10, h: 10 });     // no id
  const backBad = deserializeDoc(JSON.stringify(bad));
  assert.equal(backBad.annotations!.length, 2); // only the original two survive
});

test("blockOps round-trips, and malformed entries or dangling linkedNodeId are dropped", () => {
  const withBlockOps: FunnelDoc = {
    ...sample,
    blockOps: [
      {
        id: "bo1", linkedNodeId: "sale", purpose: "Convert warm leads into paying customers",
        requiredInputs: ["Offer page live", "Payment processor connected"],
        setupInstructions: "Publish the offer page, wire the checkout, test a $1 transaction.",
        sop: "1. Confirm tracking. 2. Confirm payment. 3. Go live.",
        checklist: [{ id: "c1", label: "Tracking pixel firing", done: true }, { id: "c2", label: "Refund policy published", done: false }],
        owner: "Jane", dueDate: "2026-03-01",
        kpis: [{ id: "k1", name: "Conversion rate", target: 0.1, actual: 0.08, unit: "%" }],
        evidenceLinks: ["https://example.com/dashboard"],
        approvalStatus: "pending", automationOpportunities: "Auto-tag buyers in the CRM.",
        integrationStatus: "manual",
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  };
  const back = deserializeDoc(serializeDoc(withBlockOps));
  assert.equal(back.blockOps?.length, 1);
  const bo = back.blockOps![0];
  assert.equal(bo.linkedNodeId, "sale");
  assert.equal(bo.owner, "Jane");
  assert.equal(bo.checklist.length, 2);
  assert.equal(bo.kpis[0].target, 0.1);
  assert.equal(bo.approvalStatus, "pending");
  assert.equal(bo.integrationStatus, "manual");
  assert.deepEqual(bo.evidenceLinks, ["https://example.com/dashboard"]);

  const bad = JSON.stringify({
    ...emptyDoc(),
    blockOps: [
      { id: "x" }, // missing linkedNodeId
      { id: "y", linkedNodeId: "does-not-exist" }, // dangling node reference, no nodes in emptyDoc()
      { linkedNodeId: "z" }, // missing id
    ],
  });
  assert.equal(deserializeDoc(bad).blockOps?.length ?? 0, 0);
});
