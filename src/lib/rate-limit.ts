// file: src/lib/rate-limit.ts
// description: In-memory fixed-window rate limiter keyed by client identifier

/**
 * Result of a single rate-limit token consumption.
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retry_after_seconds: number;
}

interface Bucket {
  count: number;
  reset_at_ms: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  /**
   * Attempts to consume one request from the bucket keyed by `key`.
   */
  take(key: string, limit: number, window_ms: number, now_ms: number = Date.now()): RateLimitResult {
    const existing = this.buckets.get(key);

    if (existing === undefined || now_ms >= existing.reset_at_ms) {
      this.buckets.set(key, { count: 1, reset_at_ms: now_ms + window_ms });
      return { allowed: true, remaining: Math.max(0, limit - 1), retry_after_seconds: Math.ceil(window_ms / 1000) };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retry_after_seconds: Math.max(1, Math.ceil((existing.reset_at_ms - now_ms) / 1000))
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count),
      retry_after_seconds: Math.max(1, Math.ceil((existing.reset_at_ms - now_ms) / 1000))
    };
  }
}
