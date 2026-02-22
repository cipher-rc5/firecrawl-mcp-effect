import { describe, expect, test } from 'bun:test';
import { ManagedRuntime } from 'effect';
import { handle_web_request } from '../../src/api/groups/mcp-handler.ts';
import { McpErrorCode } from '../../src/errors/mcp-errors.ts';
import { AppLive } from '../../src/lib/app-layer.ts';

const ENV_KEYS = [
  'FIRECRAWL_API_KEY',
  'FIRECRAWL_API_URL',
  'CLOUD_SERVICE',
  'SAFE_MODE',
  'MAX_REQUEST_BODY_BYTES',
  'REQUEST_TIMEOUT_MS',
  'RATE_LIMIT_ENABLED',
  'RATE_LIMIT_REQUESTS',
  'RATE_LIMIT_WINDOW_MS',
  'MCP_VERSION'
] as const;

async function with_env(overrides: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    previous.set(key, process.env[key]);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function request_json(
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number, json: Record<string, unknown> }> {
  const runtime = ManagedRuntime.make(AppLive);
  const request = new Request('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const response = await runtime.runPromise(handle_web_request(request));
  const json = await response.json() as Record<string, unknown>;
  return { status: response.status, json };
}

describe('mcp handler integration', () => {
  test('initialize returns configured protocol version', async () => {
    await with_env({
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-env-key',
      RATE_LIMIT_ENABLED: 'false',
      MCP_VERSION: '2025-11-25'
    }, async () => {
      const { status, json } = await request_json({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
      expect(status).toBe(200);
      const result = json['result'] as Record<string, unknown>;
      expect(result['protocolVersion']).toBe('2025-11-25');
      expect((result['capabilities'] as Record<string, unknown>)['tools']).toBeDefined();
    });
  });

  test('tools/list returns tool definitions', async () => {
    await with_env(
      { CLOUD_SERVICE: 'false', FIRECRAWL_API_KEY: 'fc-env-key', RATE_LIMIT_ENABLED: 'false' },
      async () => {
        const { status, json } = await request_json({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        expect(status).toBe(200);
        const result = json['result'] as Record<string, unknown>;
        const tools = result['tools'];
        expect(Array.isArray(tools)).toBe(true);
        expect((tools as unknown[]).length).toBeGreaterThan(0);
      }
    );
  });

  test('ping and initialized notification return empty object result', async () => {
    await with_env(
      { CLOUD_SERVICE: 'false', FIRECRAWL_API_KEY: 'fc-env-key', RATE_LIMIT_ENABLED: 'false' },
      async () => {
        const ping = await request_json({ jsonrpc: '2.0', id: 3, method: 'ping', params: {} });
        expect(ping.status).toBe(200);
        expect(ping.json['result']).toEqual({});

        const initialized = await request_json({
          jsonrpc: '2.0',
          id: 4,
          method: 'notifications/initialized',
          params: {}
        });
        expect(initialized.status).toBe(200);
        expect(initialized.json['result']).toEqual({});
      }
    );
  });

  test('unknown method maps to method_not_found', async () => {
    await with_env(
      { CLOUD_SERVICE: 'false', FIRECRAWL_API_KEY: 'fc-env-key', RATE_LIMIT_ENABLED: 'false' },
      async () => {
        const { status, json } = await request_json({ jsonrpc: '2.0', id: 5, method: 'unknown/method', params: {} });
        expect(status).toBe(200);
        const error = json['error'] as Record<string, unknown>;
        expect(error['code']).toBe(McpErrorCode.method_not_found);
      }
    );
  });

  test('invalid JSON body returns parse_error with HTTP 400', async () => {
    await with_env(
      { CLOUD_SERVICE: 'false', FIRECRAWL_API_KEY: 'fc-env-key', RATE_LIMIT_ENABLED: 'false' },
      async () => {
        const runtime = ManagedRuntime.make(AppLive);
        const request = new Request('http://localhost:3000/mcp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{not-json'
        });

        const response = await runtime.runPromise(handle_web_request(request));
        const json = await response.json() as Record<string, unknown>;
        expect(response.status).toBe(400);
        expect((json['error'] as Record<string, unknown>)['code']).toBe(McpErrorCode.parse_error);
      }
    );
  });

  test('invalid MCP request structure returns invalid_request with HTTP 400', async () => {
    await with_env(
      { CLOUD_SERVICE: 'false', FIRECRAWL_API_KEY: 'fc-env-key', RATE_LIMIT_ENABLED: 'false' },
      async () => {
        const { status, json } = await request_json({ foo: 'bar' });
        expect(status).toBe(400);
        const error = json['error'] as Record<string, unknown>;
        expect(error['code']).toBe(McpErrorCode.invalid_request);
      }
    );
  });

  test('tools/call with non-string name returns invalid_params', async () => {
    await with_env(
      { CLOUD_SERVICE: 'false', FIRECRAWL_API_KEY: 'fc-env-key', RATE_LIMIT_ENABLED: 'false' },
      async () => {
        const { status, json } = await request_json({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: { name: 123, arguments: {} }
        });
        expect(status).toBe(200);
        const error = json['error'] as Record<string, unknown>;
        expect(error['code']).toBe(McpErrorCode.invalid_params);
      }
    );
  });
});
