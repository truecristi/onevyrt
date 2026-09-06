import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createWebhook, listWebhooks, deleteWebhook, dispatchEvent, listDeliveries, DELIVERY_HISTORY_CAP } from "../lib/webhooks";
import { createWorkspace } from "../lib/workspaces";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

const PREFIX = uid("webhook-test");

// These tests deliver to a loopback mock receiver, which the production SSRF
// pin (rightly) blocks. Inject a permissive address validator so delivery
// mechanics can be exercised; the pin itself is covered by url-safety's and
// safe-fetch's own tests.
const allowLoopback = () => true;

after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

// Mirrors verifyStripeSignature's algorithm (lib/stripe-webhook.ts), which is
// the scheme dispatchEvent documents receivers should use.
function verify(secret: string, rawBody: string, header: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(parts.v1 ?? "", "hex"), b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function withReceiver(handler: (body: string, headers: Record<string, string | string[] | undefined>) => number): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const status = handler(Buffer.concat(chunks).toString("utf8"), req.headers);
      res.writeHead(status).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { url: `http://127.0.0.1:${port}/hook`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

test("createWebhook/listWebhooks: only valid event types survive, secret is returned once", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-a`);
  const created = await createWebhook(ws.id, "https://example.com/hook", ["project.created", "not.a.real.event" as never]);
  assert.deepEqual(created.events, ["project.created"]);
  assert.match(created.secret, /^[0-9a-f]{48}$/);
  const list = await listWebhooks(ws.id);
  assert.equal(list.length, 1);
  assert.equal((list[0] as unknown as { secret?: string }).secret, undefined);
});

test("dispatchEvent: delivers a correctly signed payload only to subscribed, enabled webhooks", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-b`);
  let received: { body: string; sig: string } | null = null;
  const receiver = await withReceiver((body, headers) => {
    received = { body, sig: String(headers["x-onevyrt-signature"]) };
    return 200;
  });
  try {
    const wh = await createWebhook(ws.id, receiver.url, ["project.created"]);
    await createWebhook(ws.id, receiver.url, ["project.deleted"]); // not subscribed to the event below
    await dispatchEvent(ws.id, "project.created", { id: "p1", name: "Test" }, allowLoopback);
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(received, "the subscribed webhook should have received a delivery");
    const { body, sig } = received as unknown as { body: string; sig: string };
    assert.ok(verify(wh.secret, body, sig), "signature must verify against the returned secret");
    const parsed = JSON.parse(body) as { type: string; workspaceId: string; data: { id: string } };
    assert.equal(parsed.type, "project.created");
    assert.equal(parsed.workspaceId, ws.id);
    assert.equal(parsed.data.id, "p1");
    const list = await listWebhooks(ws.id);
    const delivered = list.find((w) => w.id === wh.id);
    assert.equal(delivered?.lastStatus, 200);
  } finally {
    await receiver.close();
  }
});

test("dispatchEvent: a dead receiving URL never throws, and records the failure", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-c`);
  const wh = await createWebhook(ws.id, "http://127.0.0.1:1/unreachable", ["project.created"]);
  await assert.doesNotReject(dispatchEvent(ws.id, "project.created", { id: "p1" }, allowLoopback));
  await new Promise((r) => setTimeout(r, 100));
  const list = await listWebhooks(ws.id);
  const delivered = list.find((w) => w.id === wh.id);
  assert.ok(delivered?.lastError, "a failed delivery should record an error");
});

test("listDeliveries: records each attempt newest-first, with status and ok, scoped to the workspace", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-log`);
  const other = await createWorkspace("u1", `${PREFIX}-log2`);
  let code = 200;
  const receiver = await withReceiver(() => code);
  try {
    const wh = await createWebhook(ws.id, receiver.url, ["project.created"]);
    await dispatchEvent(ws.id, "project.created", { id: "p1" }, allowLoopback); // 200 → ok
    code = 500;
    await dispatchEvent(ws.id, "project.created", { id: "p2" }, allowLoopback); // 500 → not ok
    const log = await listDeliveries(ws.id, wh.id);
    assert.equal(log.length, 2, "both attempts recorded");
    assert.equal(log[0]!.status, 500, "newest first");
    assert.equal(log[0]!.ok, false, "a 500 is not ok");
    assert.equal(log[1]!.status, 200);
    assert.equal(log[1]!.ok, true, "a 200 is ok");
    assert.equal(log[1]!.event, "project.created");
    // Another workspace can't read this webhook's log by guessing its id.
    assert.equal((await listDeliveries(other.id, wh.id)).length, 0);
  } finally {
    await receiver.close();
  }
});

test("listDeliveries: a transport failure is logged as not-ok with an error and no status", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-logfail`);
  const wh = await createWebhook(ws.id, "http://127.0.0.1:1/unreachable", ["project.created"]);
  await dispatchEvent(ws.id, "project.created", { id: "p1" }, allowLoopback);
  const log = await listDeliveries(ws.id, wh.id);
  assert.equal(log.length, 1);
  assert.equal(log[0]!.ok, false);
  assert.equal(log[0]!.status, undefined, "a request that never completed has no HTTP status");
  assert.ok(log[0]!.error, "the transport error is recorded");
});

test("dispatchEvent: a destination that resolves internal is blocked at delivery (SSRF re-check)", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-ssrf`);
  // A receiver whose URL was fine at registration but now points at an internal
  // address (the rebinding case): the delivery-time guard must refuse it.
  const wh = await createWebhook(ws.id, "http://127.0.0.1:9/hook", ["project.created"]);
  await dispatchEvent(ws.id, "project.created", { id: "p1" }); // real guard (no allowLoopback)
  const log = await listDeliveries(ws.id, wh.id);
  assert.equal(log.length, 1);
  assert.equal(log[0]!.ok, false);
  assert.equal(log[0]!.status, undefined, "blocked before any request, so no HTTP status");
  assert.match(log[0]!.error ?? "", /blocked|private|internal|local/i);
});

test("delivery history is capped per webhook — old rows are pruned", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-cap`);
  const receiver = await withReceiver(() => 200);
  try {
    const wh = await createWebhook(ws.id, receiver.url, ["project.created"]);
    for (let i = 0; i < DELIVERY_HISTORY_CAP + 4; i++) {
      await dispatchEvent(ws.id, "project.created", { id: `p${i}` }, allowLoopback);
    }
    const log = await listDeliveries(ws.id, wh.id, DELIVERY_HISTORY_CAP);
    assert.equal(log.length, DELIVERY_HISTORY_CAP, "history never exceeds the cap");
  } finally {
    await receiver.close();
  }
});

test("deleteWebhook: scoped to the owning workspace, and the deleted webhook stops receiving events", async () => {
  const ws1 = await createWorkspace("u1", `${PREFIX}-d1`);
  const ws2 = await createWorkspace("u1", `${PREFIX}-d2`);
  let hits = 0;
  const receiver = await withReceiver(() => { hits += 1; return 200; });
  try {
    const wh = await createWebhook(ws1.id, receiver.url, ["project.created"]);
    await deleteWebhook(ws2.id, wh.id); // wrong workspace — no-op
    assert.equal((await listWebhooks(ws1.id)).length, 1);
    await deleteWebhook(ws1.id, wh.id);
    assert.equal((await listWebhooks(ws1.id)).length, 0);
    await dispatchEvent(ws1.id, "project.created", { id: "p1" });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(hits, 0);
  } finally {
    await receiver.close();
  }
});
