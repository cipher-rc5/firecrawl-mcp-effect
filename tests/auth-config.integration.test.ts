import { describe, expect, test } from 'bun:test';
import { Effect, ManagedRuntime } from 'effect';
import { handle_web_request } from '../src/api/groups/mcp-handler.ts';
import { AppConfig, AppConfigLive } from '../src/config/app-config.ts';
import { McpErrorCode } from '../src/errors/mcp-errors.ts';
import { AppLive } from '../src/lib/app-layer.ts';
import { AppMetrics } from '../src/services/metrics.ts';

const ENV_KEYS = [
  'FIRECRAWL_API_KEY',
  'FIRECRAWL_API_URL',
  'CLOUD_SERVICE',
  'SAFE_MODE',
  'MAX_REQUEST_BODY_BYTES',
  'REQUEST_TIMEOUT_MS',
  'RATE_LIMIT_ENABLED',
  'RATE_LIMIT_REQUESTS',
  'RATE_LIMIT_WINDOW_MS'
] as const;

const TOOL_CALL_UNKNOWN = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'does_not_exist', arguments: {} }
} as const;

async function with_env(overrides: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    previous.set(key, process.env[key]);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function run_request(
  body: unknown,
  headers: Record<string, string> = {},
  runtime: ManagedRuntime.ManagedRuntime<any, any> = ManagedRuntime.make(AppLive)
): Promise<{ status: number, json: any }> {
  const request = new Request('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });

  const response = await runtime.runPromise(handle_web_request(request));
  const json = await response.json();
  return { status: response.status, json };
}

describe('auth and config matrix', () => {
  test('normalizes blank FIRECRAWL env values to undefined', async () => {
    await with_env({ FIRECRAWL_API_KEY: '   ', FIRECRAWL_API_URL: '   ', CLOUD_SERVICE: 'false' }, async () => {
      const config = await Effect.runPromise(
        Effect.gen(function*() {
          return yield* AppConfig;
        }).pipe(Effect.provide(AppConfigLive))
      );

      expect(config.firecrawl_api_key).toBeUndefined();
      expect(config.firecrawl_api_url).toBeUndefined();
    });
  });

  test('cloud mode requires header key per request', async () => {
    await with_env({
      CLOUD_SERVICE: 'true',
      FIRECRAWL_API_KEY: 'fc-env-key-not-used',
      FIRECRAWL_API_URL: '',
      RATE_LIMIT_ENABLED: 'false'
    }, async () => {
      const { status, json } = await run_request(TOOL_CALL_UNKNOWN);
      expect(status).toBe(200);
      expect(json.error.code).toBe(McpErrorCode.unauthorized);
    });
  });

  test('cloud mode with header key proceeds to tool resolution', async () => {
    await with_env({ CLOUD_SERVICE: 'true', FIRECRAWL_API_URL: '   ', RATE_LIMIT_ENABLED: 'false' }, async () => {
      const { status, json } = await run_request(TOOL_CALL_UNKNOWN, { 'x-firecrawl-api-key': 'fc-header-key' });
      expect(status).toBe(200);
      expect(json.error.code).toBe(McpErrorCode.tool_not_found);
    });
  });

  test('non-cloud mode with env key proceeds without header', async () => {
    await with_env({
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-env-key',
      FIRECRAWL_API_URL: '',
      RATE_LIMIT_ENABLED: 'false'
    }, async () => {
      const { status, json } = await run_request(TOOL_CALL_UNKNOWN);
      expect(status).toBe(200);
      expect(json.error.code).toBe(McpErrorCode.tool_not_found);
    });
  });

  test('enforces body size and per-ip rate limit controls', async () => {
    await with_env({
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-env-key',
      MAX_REQUEST_BODY_BYTES: '200',
      RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_REQUESTS: '1',
      RATE_LIMIT_WINDOW_MS: '60000'
    }, async () => {
      const runtime = ManagedRuntime.make(AppLive);
      const large_body = { jsonrpc: '2.0', id: 9, method: 'tools/list', params: { padding: 'x'.repeat(1000) } };
      const too_large = await run_request(large_body, { 'x-forwarded-for': '203.0.113.10' }, runtime);
      expect(too_large.status).toBe(413);

      const ok = await run_request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, {
        'x-forwarded-for': '198.51.100.10'
      }, runtime);
      expect(ok.status).toBe(200);

      const limited = await run_request({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, {
        'x-forwarded-for': '198.51.100.10'
      }, runtime);
      expect(limited.status).toBe(429);
      expect(limited.json.error.code).toBe(McpErrorCode.rate_limited);
    });
  });

  test('enforces request timeout budget', async () => {
    await with_env({
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-env-key',
      REQUEST_TIMEOUT_MS: '10',
      RATE_LIMIT_ENABLED: 'false'
    }, async () => {
      const slow_request = {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/list', params: {} });
        }
      } as unknown as Request;

      const runtime = ManagedRuntime.make(AppLive);
      const response = await runtime.runPromise(handle_web_request(slow_request));
      const json = await response.json() as any;

      expect(response.status).toBe(504);
      expect(json.error.code).toBe(McpErrorCode.internal_error);
    });
  });

  test('emits request id header and metrics counters', async () => {
    await with_env(
      { CLOUD_SERVICE: 'false', FIRECRAWL_API_KEY: 'fc-env-key', RATE_LIMIT_ENABLED: 'false' },
      async () => {
        const runtime = ManagedRuntime.make(AppLive);
        const request = new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} })
        });

        const response = await runtime.runPromise(handle_web_request(request));
        expect(response.status).toBe(200);
        const request_id = response.headers.get('X-Request-Id');
        expect(typeof request_id).toBe('string');
        expect((request_id ?? '').length).toBeGreaterThan(0);

        const metrics_text = await runtime.runPromise(Effect.gen(function*() {
          const metrics = yield* AppMetrics;
          return metrics.export_prometheus();
        }));

        expect(metrics_text.includes('mcp_requests_total')).toBe(true);
        expect(metrics_text.includes('mcp_request_duration_ms_total')).toBe(true);
      }
    );
  });
});
