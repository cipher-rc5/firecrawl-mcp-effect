// file: tests/unit/safe-mode.unit.test.ts
// description: Verifies that safe mode strips disallowed parameters before forwarding
//   requests to the Firecrawl client. Uses mock client — no live credentials required.

import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { McpErrorCode } from '../../src/errors/mcp-errors.ts';
import { make_mock_client, mock_request, with_env } from '../helpers/test-layer.ts';

const SAFE_ENV = {
  CLOUD_SERVICE: 'false',
  FIRECRAWL_API_KEY: 'fc-test-safe',
  SAFE_MODE: 'true',
  RATE_LIMIT_ENABLED: 'false'
} as const;

describe('safe mode', () => {
  test('firecrawl_scrape strips actions in safe mode', async () => {
    await with_env(SAFE_ENV, async () => {
      let captured_options: Record<string, unknown> = {};

      const mock = make_mock_client({
        scrape: (_url, options) => {
          captured_options = options;
          return Effect.succeed({ markdown: 'content' });
        }
      });

      await mock_request({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'firecrawl_scrape',
          arguments: {
            url: 'https://example.com',
            formats: ['markdown'],
            actions: [{ type: 'click', selector: '#btn' }]
          }
        }
      }, mock);

      expect(captured_options['actions']).toBeUndefined();
    });
  });

  test('firecrawl_crawl strips webhook in safe mode', async () => {
    await with_env(SAFE_ENV, async () => {
      let captured_options: Record<string, unknown> = {};

      const mock = make_mock_client({
        crawl: (_url, options) => {
          captured_options = options;
          return Effect.succeed({ id: 'crawl-123' });
        }
      });

      await mock_request({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'firecrawl_crawl',
          arguments: { url: 'https://example.com', webhook: 'https://my-server.com/hook' }
        }
      }, mock);

      expect(captured_options['webhook']).toBeUndefined();
    });
  });

  test('firecrawl_browser_execute is rejected in safe mode', async () => {
    await with_env(SAFE_ENV, async () => {
      const mock = make_mock_client({});

      const { json } = await mock_request({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'firecrawl_browser_execute',
          arguments: { sessionId: 'sess-abc', code: 'return document.title' }
        }
      }, mock);

      const error = json['error'] as Record<string, unknown>;
      expect(error['code']).toBe(McpErrorCode.invalid_params);
      const message = (error['message'] as string).toLowerCase();
      expect(message).toContain('safe mode');
    });
  });

  test('firecrawl_scrape passes non-action options through in safe mode', async () => {
    await with_env(SAFE_ENV, async () => {
      let captured_url = '';
      let captured_options: Record<string, unknown> = {};

      const mock = make_mock_client({
        scrape: (url, options) => {
          captured_url = url;
          captured_options = options;
          return Effect.succeed({ markdown: 'hello' });
        }
      });

      await mock_request({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'firecrawl_scrape',
          arguments: { url: 'https://example.com', formats: ['markdown'], onlyMainContent: true }
        }
      }, mock);

      expect(captured_url).toBe('https://example.com');
      expect(captured_options['formats']).toEqual(['markdown']);
      expect(captured_options['onlyMainContent']).toBe(true);
    });
  });
});
