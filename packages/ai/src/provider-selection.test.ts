import { describe, expect, it } from "vitest";
import type { Env } from "@onevyrt/contracts";
import { selectDefaultProvider } from "./provider-selection";

const BASE_ENV: Env = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://user:pass@localhost:5432/onevyrt_test",
  AUTH_SECRET: "a".repeat(64),
  APP_URL: "http://localhost:3000",
};

describe("selectDefaultProvider", () => {
  it("falls back to the deterministic provider when no API key is configured", () => {
    const provider = selectDefaultProvider(BASE_ENV);
    expect(provider.id).toBe("deterministic");
  });

  it("selects the Anthropic provider when an API key is configured", () => {
    const provider = selectDefaultProvider({ ...BASE_ENV, ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(provider.id).toBe("anthropic");
  });
});
