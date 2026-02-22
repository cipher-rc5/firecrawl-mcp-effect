// file: tests/unit/rate-limit-http.unit.test.ts
// description: Verifies that the HTTP handler returns 429 when the in-memory rate limiter
// blocks a client IP. Uses a shared ManagedRuntime per test so state accumulates
// across requests (as it would in the real server process).

import { describe, expect, test } from 'bun:test';
import { ManagedRuntime } from 'effect';
import { McpErrorCode } from '../../src/errors/mcp-errors.ts';
import { make_mock_client, make_test_layer, runtime_request, with_env } from '../helpers/test-layer.ts';

describe('rate limit HTTP enforcement', () => {
  test('returns 429 after exceeding request window limit', async () => {
    // Use a unique IP to avoid cross-test state in the in-memory limiter
    const TEST_IP = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    const RL_ENV = {
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-test-rl',
      RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_REQUESTS: '2',
      RATE_LIMIT_WINDOW_MS: '60000'
    };

    await with_env(RL_ENV, async () => {
      const mock = make_mock_client({});
      const layer = make_test_layer(mock);
      const runtime = ManagedRuntime.make(layer);

      try {
        const body = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
        const headers = { 'x-forwarded-for': TEST_IP };

        // First two requests should be allowed
        const r1 = await runtime_request(runtime, body, headers);
        expect(r1.status).toBe(200);

        const r2 = await runtime_request(runtime, body, headers);
        expect(r2.status).toBe(200);

        // Third from the same IP should be rate limited
        const r3 = await runtime_request(runtime, body, headers);
        expect(r3.status).toBe(429);
        const error = r3.json['error'] as Record<string, unknown>;
        expect(error['code']).toBe(McpErrorCode.rate_limited);
      } finally {
        await runtime.dispose();
      }
    });
  });

  test('different IPs are rate limited independently', async () => {
    const IP_A = `10.1.${Math.floor(Math.random() * 255)}.1`;
    const IP_B = `10.2.${Math.floor(Math.random() * 255)}.1`;

    const RL_ENV = {
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-test-rl',
      RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_REQUESTS: '1',
      RATE_LIMIT_WINDOW_MS: '60000'
    };

    await with_env(RL_ENV, async () => {
      const mock = make_mock_client({});
      const layer = make_test_layer(mock);
      const runtime = ManagedRuntime.make(layer);

      try {
        const body = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };

        // IP_A uses its one allowed request
        const r1 = await runtime_request(runtime, body, { 'x-forwarded-for': IP_A });
        expect(r1.status).toBe(200);

        // IP_A is now rate limited
        const r2 = await runtime_request(runtime, body, { 'x-forwarded-for': IP_A });
        expect(r2.status).toBe(429);

        // IP_B is still within its independent window
        const r3 = await runtime_request(runtime, body, { 'x-forwarded-for': IP_B });
        expect(r3.status).toBe(200);
      } finally {
        await runtime.dispose();
      }
    });
  });

  test('rate limiting is skipped when RATE_LIMIT_ENABLED is false', async () => {
    const TEST_IP = `10.3.${Math.floor(Math.random() * 255)}.1`;

    const RL_ENV = {
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-test-rl',
      RATE_LIMIT_ENABLED: 'false',
      RATE_LIMIT_REQUESTS: '1',
      RATE_LIMIT_WINDOW_MS: '60000'
    };

    await with_env(RL_ENV, async () => {
      const mock = make_mock_client({});
      const layer = make_test_layer(mock);
      const runtime = ManagedRuntime.make(layer);

      try {
        const body = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
        const headers = { 'x-forwarded-for': TEST_IP };

        // All three should succeed even though limit is 1 (disabled)
        for (let i = 0;i < 3;i++) {
          const result = await runtime_request(runtime, body, headers);
          expect(result.status).toBe(200);
        }
      } finally {
        await runtime.dispose();
      }
    });
  });
});
