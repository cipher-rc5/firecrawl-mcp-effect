import { describe, expect, test } from 'bun:test';
import { InMemoryRateLimiter } from '../../src/lib/rate-limit.ts';

describe('InMemoryRateLimiter', () => {
  test('allows up to configured limit in fixed window', () => {
    const limiter = new InMemoryRateLimiter();
    const now = 1_000;

    const first = limiter.take('ip:1', 2, 10_000, now);
    const second = limiter.take('ip:1', 2, 10_000, now + 1);
    const third = limiter.take('ip:1', 2, 10_000, now + 2);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.retry_after_seconds).toBeGreaterThan(0);
  });

  test('resets quota after window passes', () => {
    const limiter = new InMemoryRateLimiter();
    const now = 5_000;

    limiter.take('ip:2', 1, 2_000, now);
    const blocked = limiter.take('ip:2', 1, 2_000, now + 100);
    const reset = limiter.take('ip:2', 1, 2_000, now + 2_100);

    expect(blocked.allowed).toBe(false);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(0);
  });

  test('tracks buckets independently per key', () => {
    const limiter = new InMemoryRateLimiter();
    const now = 10_000;

    const a1 = limiter.take('a', 1, 1_000, now);
    const b1 = limiter.take('b', 1, 1_000, now);
    const a2 = limiter.take('a', 1, 1_000, now + 1);

    expect(a1.allowed).toBe(true);
    expect(b1.allowed).toBe(true);
    expect(a2.allowed).toBe(false);
  });
});
