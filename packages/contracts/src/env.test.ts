import { describe, expect, it, beforeEach } from "vitest";
import { loadEnv, resetEnvCacheForTests } from "./env";

const validEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://user:pass@localhost:5432/onevyrt_test",
  AUTH_SECRET: "a".repeat(64),
  APP_URL: "http://localhost:3000",
};

describe("loadEnv", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
  });

  it("parses a valid environment", () => {
    const env = loadEnv(validEnv);
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects a missing DATABASE_URL", () => {
    const { DATABASE_URL: _DATABASE_URL, ...rest } = validEnv;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it("rejects an AUTH_SECRET that is not 64 hex characters", () => {
    expect(() => loadEnv({ ...validEnv, AUTH_SECRET: "too-short" })).toThrow(/AUTH_SECRET/);
  });

  it("defaults APP_URL and NODE_ENV when not provided", () => {
    const { APP_URL: _APP_URL, NODE_ENV: _NODE_ENV, ...rest } = validEnv;
    const env = loadEnv(rest as NodeJS.ProcessEnv);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("development");
  });

  it("caches the result across calls until reset", () => {
    const first = loadEnv(validEnv);
    const second = loadEnv({ ...validEnv, DATABASE_URL: "postgres://different" });
    expect(second).toBe(first);
  });
});
