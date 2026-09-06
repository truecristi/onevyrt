import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_PROVIDERS,
  getAIProvider,
  providerCanGenerate,
  buildAIRequest,
  buildAIChatRequest,
  parseAIResponse,
  keyLooksValid,
} from "../lib/ai/providers";

test("buildAIChatRequest: OpenAI shape prepends the system message to history", () => {
  const p = getAIProvider("openai")!;
  const body = JSON.parse(buildAIChatRequest(p, "sk-x", "gpt-4o", "SYS", [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "more" },
  ], 300).body);
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[0].content, "SYS");
  assert.equal(body.messages.length, 4);
  assert.equal(body.messages[3].content, "more");
});

test("buildAIChatRequest: Anthropic keeps system top-level, history in messages", () => {
  const p = getAIProvider("anthropic")!;
  const body = JSON.parse(buildAIChatRequest(p, "sk-ant-x", "", "SYS", [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ], 300).body);
  assert.equal(body.system, "SYS");
  assert.equal(body.messages.length, 2, "no system message injected into the array");
  assert.equal(body.messages[0].role, "user");
});

test("providers: the expected set exists and ids are unique", () => {
  const ids = AI_PROVIDERS.map((p) => p.id);
  for (const id of ["openai", "anthropic", "xai", "openrouter", "manual"]) {
    assert.ok(ids.includes(id as (typeof ids)[number]), `missing provider ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length, "duplicate provider id");
});

test("providerCanGenerate: true for real providers, false for manual", () => {
  assert.equal(providerCanGenerate("openai"), true);
  assert.equal(providerCanGenerate("anthropic"), true);
  assert.equal(providerCanGenerate("manual"), false);
  assert.equal(providerCanGenerate("nope"), false);
});

test("buildAIRequest: OpenAI-format providers share the chat-completions shape", () => {
  const p = getAIProvider("openai")!;
  const req = buildAIRequest(p, "sk-abc", "gpt-4o", "SYS", "USER", 500);
  assert.equal(req.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(req.headers.authorization, "Bearer sk-abc");
  const body = JSON.parse(req.body);
  assert.equal(body.model, "gpt-4o");
  assert.equal(body.max_tokens, 500);
  assert.deepEqual(body.messages, [
    { role: "system", content: "SYS" },
    { role: "user", content: "USER" },
  ]);
});

test("buildAIRequest: xAI and OpenRouter also use the OpenAI shape + Bearer auth", () => {
  for (const id of ["xai", "openrouter"]) {
    const p = getAIProvider(id)!;
    const req = buildAIRequest(p, "key123", "", "S", "U", 100);
    assert.equal(req.headers.authorization, "Bearer key123");
    const body = JSON.parse(req.body);
    assert.equal(body.model, p.defaultModel, `${id} should fall back to its default model`);
    assert.ok(Array.isArray(body.messages));
  }
});

test("buildAIRequest: OpenRouter carries attribution headers; xAI/OpenAI do not", () => {
  const or = buildAIRequest(getAIProvider("openrouter")!, "k", "", "S", "U", 100);
  assert.equal(or.headers["X-Title"], "OneVYRT");
  assert.ok(or.headers["HTTP-Referer"], "OpenRouter request has an HTTP-Referer");
  for (const id of ["xai", "openai"]) {
    const req = buildAIRequest(getAIProvider(id)!, "k", "", "S", "U", 100);
    assert.equal(req.headers["X-Title"], undefined, `${id} should not send X-Title`);
  }
});

test("buildAIRequest: Anthropic uses the Messages API shape and headers", () => {
  const p = getAIProvider("anthropic")!;
  const req = buildAIRequest(p, "sk-ant-xyz", "claude-3-5-haiku-latest", "SYS", "USER", 400);
  assert.equal(req.url, "https://api.anthropic.com/v1/messages");
  assert.equal(req.headers["x-api-key"], "sk-ant-xyz");
  assert.equal(req.headers["anthropic-version"], "2023-06-01");
  assert.equal(req.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(req.headers.authorization, undefined, "Anthropic must not use Bearer auth");
  const body = JSON.parse(req.body);
  assert.equal(body.system, "SYS", "system prompt is top-level for Anthropic");
  assert.deepEqual(body.messages, [{ role: "user", content: "USER" }]);
});

test("buildAIRequest: empty model falls back to the provider default", () => {
  const p = getAIProvider("openai")!;
  const body = JSON.parse(buildAIRequest(p, "sk-x", "   ", "S", "U", 10).body);
  assert.equal(body.model, p.defaultModel);
});

test("buildAIRequest: manual provider has no endpoint and throws", () => {
  const p = getAIProvider("manual")!;
  assert.throws(() => buildAIRequest(p, "", "", "S", "U", 10));
});

test("parseAIResponse: reads OpenAI choices[0].message.content", () => {
  const p = getAIProvider("openai")!;
  const text = parseAIResponse(p, { choices: [{ message: { content: "  hello world  " } }] });
  assert.equal(text, "hello world");
});

test("parseAIResponse: reads Anthropic text content blocks, joined", () => {
  const p = getAIProvider("anthropic")!;
  const text = parseAIResponse(p, {
    content: [
      { type: "text", text: "Hello " },
      { type: "tool_use", id: "x" },
      { type: "text", text: "there" },
    ],
  });
  assert.equal(text, "Hello there");
});

test("parseAIResponse: malformed responses yield empty string, not a throw", () => {
  assert.equal(parseAIResponse(getAIProvider("openai")!, {}), "");
  assert.equal(parseAIResponse(getAIProvider("anthropic")!, { content: "nope" }), "");
  assert.equal(parseAIResponse(getAIProvider("openai")!, null), "");
});

test("keyLooksValid: honours provider prefixes, rejects blanks", () => {
  assert.equal(keyLooksValid(getAIProvider("openai")!, "sk-abc123"), true);
  assert.equal(keyLooksValid(getAIProvider("openai")!, "nope"), false);
  assert.equal(keyLooksValid(getAIProvider("anthropic")!, "sk-ant-abc"), true);
  assert.equal(keyLooksValid(getAIProvider("anthropic")!, "sk-abc"), false);
  assert.equal(keyLooksValid(getAIProvider("openrouter")!, "sk-or-longenoughkey"), true);
  assert.equal(keyLooksValid(getAIProvider("openai")!, "   "), false);
});
