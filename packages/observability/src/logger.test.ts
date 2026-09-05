import { describe, expect, it, vi, afterEach } from "vitest";
import { logger, newCorrelationId } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits structured JSON with a message and level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hello", { route: "/api/health" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello");
    expect(parsed.route).toBe("/api/health");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("routes warn/error to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("redacts sensitive fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("login attempt", { password: "hunter2", sessionToken: "abc" });
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.sessionToken).toBe("[redacted]");
  });

  it("generates unique correlation IDs", () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId());
  });
});
