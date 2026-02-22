// file: tests/unit/timeout.unit.test.ts
// description: Verifies that long-running tool calls are aborted at REQUEST_TIMEOUT_MS
// and the handler returns HTTP 504 with the correct error code.

import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { McpErrorCode } from '../../src/errors/mcp-errors.ts';
import { make_mock_client, mock_request, with_env } from '../helpers/test-layer.ts';

describe('request timeout', () => {
  test('returns 504 when tool call exceeds REQUEST_TIMEOUT_MS', async () => {
    const TIMEOUT_ENV = {
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-test-timeout',
      REQUEST_TIMEOUT_MS: '150', // very short for test
      RATE_LIMIT_ENABLED: 'false'
    };

    await with_env(TIMEOUT_ENV, async () => {
      const mock = make_mock_client({
        scrape: () =>
          // Delay longer than the timeout budget
          Effect.sleep('600 millis').pipe(Effect.flatMap(() => Effect.succeed({ markdown: 'too late' })))
      });

      const { status, json } = await mock_request({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'firecrawl_scrape', arguments: { url: 'https://example.com', formats: ['markdown'] } }
      }, mock);

      expect(status).toBe(504);
      const error = json['error'] as Record<string, unknown>;
      expect(error['code']).toBe(McpErrorCode.internal_error);
      const message = (error['message'] as string).toLowerCase();
      expect(message).toContain('timed out');
    });
  });

  test('succeeds when tool call completes within REQUEST_TIMEOUT_MS', async () => {
    const TIMEOUT_ENV = {
      CLOUD_SERVICE: 'false',
      FIRECRAWL_API_KEY: 'fc-test-timeout',
      REQUEST_TIMEOUT_MS: '5000',
      RATE_LIMIT_ENABLED: 'false'
    };

    await with_env(TIMEOUT_ENV, async () => {
      const mock = make_mock_client({ scrape: () => Effect.succeed({ markdown: 'fast response' }) });

      const { status } = await mock_request({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'firecrawl_scrape', arguments: { url: 'https://example.com', formats: ['markdown'] } }
      }, mock);

      expect(status).toBe(200);
    });
  });
});
