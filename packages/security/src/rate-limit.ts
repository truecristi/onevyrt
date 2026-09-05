/**
 * In-memory sliding-window rate limiter (§11). Explicitly NOT durable -
 * resets on process restart and does not share state across instances.
 * §3 names a Redis-compatible store as the real answer; this is a
 * documented, honest placeholder until Phase 2+ needs multi-instance
 * limits (e.g. behind more than one web process).
 */

interface Bucket {
  timestamps: number[];
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if the request is allowed, false if the key is over its limit. Records the attempt either way is up to the caller. */
  check(key: string, now: number = Date.now()): boolean {
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    const windowStart = now - this.windowMs;
    bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

    if (bucket.timestamps.length >= this.limit) {
      this.buckets.set(key, bucket);
      return false;
    }

    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
    return true;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
