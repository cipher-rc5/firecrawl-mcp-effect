// file: src/services/rate-limiter.ts
// description: Effect service for request rate limiting using in-memory fixed windows

import { Context, Effect, Layer } from 'effect';
import { AppConfig } from '../config/app-config.ts';
import { InMemoryRateLimiter, type RateLimitResult } from '../lib/rate-limit.ts';

/**
 * Public operations exposed by the rate limiter service.
 */
export interface RateLimiterOps {
  /**
   * Attempts to consume one request token for a client identifier.
   */
  readonly take: (client_id: string) => RateLimitResult;
}

/**
 * Dependency-inverted service tag for rate-limiting behavior.
 */
export class RateLimiter extends Context.Tag('RateLimiter')<RateLimiter, RateLimiterOps>() {}

/**
 * In-memory implementation for local/serverless runtime instances.
 */
export const RateLimiterLive: Layer.Layer<RateLimiter, never, AppConfig> = Layer.effect(
  RateLimiter,
  Effect.gen(function*() {
    const config = yield* AppConfig;
    const limiter = new InMemoryRateLimiter();

    return {
      take: (client_id: string): RateLimitResult =>
        limiter.take(client_id, config.rate_limit_requests, config.rate_limit_window_ms)
    } satisfies RateLimiterOps;
  })
);
