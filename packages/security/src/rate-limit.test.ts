import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows requests up to the limit within the window", () => {
    const limiter = new RateLimiter(3, 1000);
    const now = 1_000_000;
    expect(limiter.check("ip:1.2.3.4", now)).toBe(true);
    expect(limiter.check("ip:1.2.3.4", now + 10)).toBe(true);
    expect(limiter.check("ip:1.2.3.4", now + 20)).toBe(true);
    expect(limiter.check("ip:1.2.3.4", now + 30)).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const limiter = new RateLimiter(1, 1000);
    const now = 1_000_000;
    expect(limiter.check("a", now)).toBe(true);
    expect(limiter.check("b", now)).toBe(true);
    expect(limiter.check("a", now)).toBe(false);
  });

  it("allows requests again once the window has passed", () => {
    const limiter = new RateLimiter(1, 1000);
    const now = 1_000_000;
    expect(limiter.check("a", now)).toBe(true);
    expect(limiter.check("a", now + 500)).toBe(false);
    expect(limiter.check("a", now + 1001)).toBe(true);
  });
});
