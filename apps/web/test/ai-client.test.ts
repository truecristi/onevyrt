import test from "node:test";
import assert from "node:assert/strict";
import { testConnection, callAI, streamAI, _retryConfig } from "../lib/ai/client";

/** Swap global.fetch for the duration of one call, restoring it after. */
async function withFetch(impl: typeof fetch, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test("testConnection: a 2xx from the provider is success — even with empty content", async () => {
  await withFetch(
    async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }),
    async () => {
      const r = await testConnection({ provider: "openai", apiKey: "sk-abc123", model: "gpt-4o-mini" });
      assert.equal(r.ok, true);
      assert.equal(r.error, undefined);
    },
  );
});

test("testConnection: a 401 reports a failure with the provider name and status", async () => {
  await withFetch(
    async () => new Response("Invalid API key", { status: 401, statusText: "Unauthorized" }),
    async () => {
      const r = await testConnection({ provider: "openai", apiKey: "sk-bad", model: "" });
      assert.equal(r.ok, false);
      assert.match(r.error ?? "", /OpenAI/);
      assert.match(r.error ?? "", /401/);
    },
  );
});

test("testConnection: a network error is caught, never thrown", async () => {
  await withFetch(
    async () => { throw new Error("ECONNREFUSED"); },
    async () => {
      const r = await testConnection({ provider: "anthropic", apiKey: "sk-ant-abc", model: "" });
      assert.equal(r.ok, false);
      assert.match(r.error ?? "", /Couldn't reach|too long/);
    },
  );
});

test("testConnection: no key connected fails fast without a request", async () => {
  let called = false;
  await withFetch(
    async () => { called = true; return new Response("", { status: 200 }); },
    async () => {
      const r = await testConnection({ provider: "openai", apiKey: "   ", model: "" });
      assert.equal(r.ok, false);
      assert.equal(called, false, "must not hit the network when no key is set");
    },
  );
});

test("testConnection: the manual provider can't be tested", async () => {
  const r = await testConnection({ provider: "manual", apiKey: "", model: "" });
  assert.equal(r.ok, false);
});

const okBody = JSON.stringify({ choices: [{ message: { content: "hi" } }] });

test("callAI: retries a transient 503 then succeeds", async () => {
  _retryConfig.baseMs = 1; _retryConfig.attempts = 3;
  let n = 0;
  await withFetch(
    async () => { n++; return n < 3 ? new Response("overloaded", { status: 503 }) : new Response(okBody, { status: 200 }); },
    async () => {
      const out = await callAI({ provider: "openai", apiKey: "sk-x", model: "" }, "S", "U");
      assert.equal(out, "hi");
      assert.equal(n, 3, "should have retried twice before succeeding");
    },
  );
});

test("callAI: does NOT retry a 401 — a bad key fails immediately", async () => {
  _retryConfig.baseMs = 1; _retryConfig.attempts = 3;
  let n = 0;
  await withFetch(
    async () => { n++; return new Response("bad key", { status: 401 }); },
    async () => {
      await assert.rejects(callAI({ provider: "openai", apiKey: "sk-x", model: "" }, "S", "U"), /401/);
      assert.equal(n, 1, "a 4xx must not be retried");
    },
  );
});

test("callAI: gives up after the configured attempts on a persistent 429", async () => {
  _retryConfig.baseMs = 1; _retryConfig.attempts = 3;
  let n = 0;
  await withFetch(
    async () => { n++; return new Response("rate limited", { status: 429 }); },
    async () => {
      await assert.rejects(callAI({ provider: "openai", apiKey: "sk-x", model: "" }, "S", "U"), /429/);
      assert.equal(n, 3, "should attempt exactly the configured number of times");
    },
  );
});

test("callAI: retries a network error then succeeds", async () => {
  _retryConfig.baseMs = 1; _retryConfig.attempts = 3;
  let n = 0;
  await withFetch(
    async () => { n++; if (n === 1) throw new Error("ECONNRESET"); return new Response(okBody, { status: 200 }); },
    async () => {
      const out = await callAI({ provider: "openai", apiKey: "sk-x", model: "" }, "S", "U");
      assert.equal(out, "hi");
      assert.equal(n, 2);
    },
  );
});

test("callAI: an already-aborted signal cancels before any request goes out", async () => {
  _retryConfig.baseMs = 1; _retryConfig.attempts = 3;
  let n = 0;
  const ac = new AbortController(); ac.abort();
  await withFetch(
    async () => { n++; return new Response(okBody, { status: 200 }); },
    async () => {
      await assert.rejects(callAI({ provider: "openai", apiKey: "sk-x", model: "" }, "S", "U", 700, ac.signal), /cancelled/i);
      assert.equal(n, 0, "must not hit the network when already cancelled");
    },
  );
});

test("streamAI: an already-aborted signal cancels before streaming", async () => {
  const ac = new AbortController(); ac.abort();
  let n = 0;
  await withFetch(
    async () => { n++; return new Response("", { status: 200 }); },
    async () => {
      await assert.rejects(
        streamAI({ provider: "openai", apiKey: "sk-x", model: "" }, "S", "U", () => {}, 700, ac.signal),
        /cancelled/i,
      );
      assert.equal(n, 0);
    },
  );
});

// --- Managed-AI fallback: when the user has no personal key on a real
// provider, callAI/streamAI use the owner's server route (/api/ai/generate). ---

test("callAI: no personal key falls back to managed AI (/api/ai/generate)", async () => {
  let hitManaged = false, hitProvider = false;
  await withFetch(
    async (input) => {
      if (String(input).includes("/api/ai/generate")) { hitManaged = true; return new Response(JSON.stringify({ text: "managed reply", used: 1, quota: 50 }), { status: 200 }); }
      hitProvider = true; return new Response(okBody, { status: 200 });
    },
    async () => {
      const out = await callAI({ provider: "openrouter", apiKey: "", model: "" }, "S", "U");
      assert.equal(out, "managed reply");
      assert.equal(hitManaged, true, "should call the managed route");
      assert.equal(hitProvider, false, "must not call the provider directly when there's no key");
    },
  );
});

test("callAI: no key and managed AI off (501) surfaces the add-your-key error", async () => {
  await withFetch(
    async (input) => String(input).includes("/api/ai/generate")
      ? new Response(JSON.stringify({ error: "not configured" }), { status: 501 })
      : new Response(okBody, { status: 200 }),
    async () => {
      await assert.rejects(callAI({ provider: "openai", apiKey: "", model: "" }, "S", "U"), /API key/i);
    },
  );
});

test("callAI: with a key, goes straight to the provider (never the managed route)", async () => {
  _retryConfig.baseMs = 1; _retryConfig.attempts = 3;
  let hitManaged = false;
  await withFetch(
    async (input) => { if (String(input).includes("/api/ai/generate")) hitManaged = true; return new Response(okBody, { status: 200 }); },
    async () => {
      const out = await callAI({ provider: "openai", apiKey: "sk-x", model: "" }, "S", "U");
      assert.equal(out, "hi");
      assert.equal(hitManaged, false, "a present key must bypass the managed route");
    },
  );
});

test("streamAI: no key falls back to managed AI, delivered in one chunk", async () => {
  const chunks: string[] = [];
  await withFetch(
    async (input) => String(input).includes("/api/ai/generate")
      ? new Response(JSON.stringify({ text: "streamed via managed", used: 1, quota: 50 }), { status: 200 })
      : new Response("", { status: 200 }),
    async () => {
      const out = await streamAI({ provider: "openrouter", apiKey: "", model: "" }, "S", "U", (d) => chunks.push(d));
      assert.equal(out, "streamed via managed");
      assert.deepEqual(chunks, ["streamed via managed"], "managed text arrives as a single onToken chunk");
    },
  );
});
