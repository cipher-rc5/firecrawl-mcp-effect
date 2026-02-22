// file: tests/unit/cloud-mode.unit.test.ts
// description: Verifies cloud service mode API key injection and rejection behavior.
// Uses mock client — no live credentials required.

import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { McpErrorCode } from '../../src/errors/mcp-errors.ts';
import { make_mock_client, mock_request, with_env } from '../helpers/test-layer.ts';

const CLOUD_ENV = { CLOUD_SERVICE: 'true', SAFE_MODE: 'true', RATE_LIMIT_ENABLED: 'false' } as const;

describe('cloud mode', () => {
  test('rejects tools/call when no API key header is present', async () => {
    await with_env(CLOUD_ENV, async () => {
      const mock = make_mock_client({});

      const { json } = await mock_request(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'firecrawl_scrape', arguments: { url: 'https://example.com' } }
        },
        mock
        // No API key headers
      );

      const error = json['error'] as Record<string, unknown>;
      expect(error['code']).toBe(McpErrorCode.unauthorized);
    });
  });

  test('accepts tools/call when x-firecrawl-api-key header is present', async () => {
    await with_env(CLOUD_ENV, async () => {
      const mock = make_mock_client({ scrape: () => Effect.succeed({ markdown: 'content' }) });

      const { status } = await mock_request(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'firecrawl_scrape', arguments: { url: 'https://example.com', formats: ['markdown'] } }
        },
        mock,
        { 'x-firecrawl-api-key': 'fc-request-key' }
      );

      // 200 means the request was processed through to the tool
      expect(status).toBe(200);
    });
  });

  test('accepts tools/call when x-api-key header is present', async () => {
    await with_env(CLOUD_ENV, async () => {
      const mock = make_mock_client({ scrape: () => Effect.succeed({ markdown: 'content' }) });

      const { status } = await mock_request(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'firecrawl_scrape', arguments: { url: 'https://example.com', formats: ['markdown'] } }
        },
        mock,
        { 'x-api-key': 'fc-request-key' }
      );

      expect(status).toBe(200);
    });
  });

  test('accepts tools/call when Authorization Bearer header is present', async () => {
    await with_env(CLOUD_ENV, async () => {
      const mock = make_mock_client({ scrape: () => Effect.succeed({ markdown: 'content' }) });

      const { status } = await mock_request(
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'firecrawl_scrape', arguments: { url: 'https://example.com', formats: ['markdown'] } }
        },
        mock,
        { 'authorization': 'Bearer fc-bearer-key' }
      );

      expect(status).toBe(200);
    });
  });

  test('initialize succeeds in cloud mode without API key (no auth needed for protocol methods)', async () => {
    await with_env(CLOUD_ENV, async () => {
      const mock = make_mock_client({});

      const { status, json } = await mock_request({ jsonrpc: '2.0', id: 5, method: 'initialize', params: {} }, mock);

      expect(status).toBe(200);
      expect(json['result']).toBeDefined();
    });
  });

  test('tools/list succeeds in cloud mode without API key', async () => {
    await with_env(CLOUD_ENV, async () => {
      const mock = make_mock_client({});

      const { status, json } = await mock_request({ jsonrpc: '2.0', id: 6, method: 'tools/list', params: {} }, mock);

      expect(status).toBe(200);
      const result = json['result'] as Record<string, unknown>;
      expect(Array.isArray(result['tools'])).toBe(true);
    });
  });
});
