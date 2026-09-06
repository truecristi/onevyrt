import test from "node:test";
import assert from "node:assert/strict";
import { getAIProvider, streamDeltaText, buildAIStreamRequest } from "../lib/ai/providers";
import { streamAI } from "../lib/ai/client";

test("streamDeltaText: OpenAI-shape reads choices[0].delta.content", () => {
  const p = getAIProvider("openai")!;
  assert.equal(streamDeltaText(p, { choices: [{ delta: { content: "Hel" } }] }), "Hel");
  assert.equal(streamDeltaText(p, { choices: [{ delta: { role: "assistant" } }] }), "", "role-only delta yields nothing");
  assert.equal(streamDeltaText(p, {}), "");
});

test("streamDeltaText: Anthropic reads text_delta from content_block_delta", () => {
  const p = getAIProvider("anthropic")!;
  assert.equal(streamDeltaText(p, { type: "content_block_delta", delta: { type: "text_delta", text: "hi" } }), "hi");
  assert.equal(streamDeltaText(p, { type: "message_start" }), "", "non-delta events yield nothing");
  assert.equal(streamDeltaText(p, { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{" } }), "", "tool deltas are not text");
});

test("buildAIStreamRequest: sets stream:true, keeps the provider endpoint + auth", () => {
  const p = getAIProvider("openai")!;
  const req = buildAIStreamRequest(p, "sk-x", "gpt-4o", "SYS", "USER", 300);
  assert.equal(req.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(req.headers.authorization, "Bearer sk-x");
  assert.equal(JSON.parse(req.body).stream, true);
});

/** Build a streaming Response from SSE frames. */
function sseResponse(frames: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, { status });
}

async function withFetch(impl: typeof fetch, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try { await fn(); } finally { globalThis.fetch = original; }
}

test("streamAI: collects OpenAI deltas across chunk boundaries and reports each token", async () => {
  // Deliberately split an SSE line across two network chunks to prove the
  // buffer stitches partial lines back together.
  const frames = [
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"del',
    'ta":{"content":"lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n',
  ];
  await withFetch(
    async () => sseResponse(frames),
    async () => {
      const tokens: string[] = [];
      const full = await streamAI(
        { provider: "openai", apiKey: "sk-abc", model: "gpt-4o-mini" },
        "SYS", "USER",
        (t) => tokens.push(t),
      );
      assert.equal(full, "Hello world");
      assert.deepEqual(tokens, ["Hel", "lo", " world"]);
    },
  );
});

test("streamAI: an empty stream throws the same user-facing error as callAI", async () => {
  await withFetch(
    async () => sseResponse(["data: [DONE]\n\n"]),
    async () => {
      await assert.rejects(
        streamAI({ provider: "openai", apiKey: "sk-abc", model: "" }, "S", "U", () => {}),
        /empty response/,
      );
    },
  );
});

test("streamAI: a non-2xx throws with the provider name and status", async () => {
  await withFetch(
    async () => new Response("nope", { status: 429, statusText: "Too Many Requests" }),
    async () => {
      await assert.rejects(
        streamAI({ provider: "openai", apiKey: "sk-abc", model: "" }, "S", "U", () => {}),
        /error 429/,
      );
    },
  );
});
