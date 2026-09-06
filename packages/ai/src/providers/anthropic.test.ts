import { describe, expect, it, vi, afterEach } from "vitest";
import { createAnthropicProvider } from "./anthropic";
import { AiProviderError } from "../types";
import type { CompletionRequest } from "../types";

const request: CompletionRequest = {
  model: "claude-sonnet-5",
  messages: [{ role: "user", content: "Explain unit economics" }],
  maxTokens: 200,
};

describe("createAnthropicProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps a successful response into the provider-neutral shape", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "claude-sonnet-5",
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Unit economics is..." }],
          usage: { input_tokens: 12, output_tokens: 34 },
        }),
        { status: 200 },
      ),
    );

    const provider = createAnthropicProvider({ apiKey: "sk-ant-test" });
    const result = await provider.complete(request);

    expect(result.text).toBe("Unit economics is...");
    expect(result.stopReason).toBe("end_turn");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 34 });
    expect(result.providerId).toBe("anthropic");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-test");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: request.model });
  });

  it("throws AiProviderError on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));

    const provider = createAnthropicProvider({ apiKey: "sk-ant-test" });
    await expect(provider.complete(request)).rejects.toThrow(AiProviderError);
  });

  it("falls back to the config's defaultModel when the request has none", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ model: "fallback-model", content: [], usage: {} }), {
        status: 200,
      }),
    );

    const provider = createAnthropicProvider({
      apiKey: "sk-ant-test",
      defaultModel: "fallback-model",
    });
    await provider.complete({ ...request, model: "" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "fallback-model" });
  });
});
