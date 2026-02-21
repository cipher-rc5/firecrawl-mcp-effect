// file: tests/helpers/test-layer.ts
// description: Test utilities for constructing Effect layers with mock FirecrawlClient
//   implementations. All helpers here avoid live credentials — smoke tests handle that.

import { ConfigError, Effect, Layer, ManagedRuntime } from 'effect';
import { handle_web_request } from '../../src/api/groups/mcp-handler.ts';
import { AppConfigLive } from '../../src/config/app-config.ts';
import { FirecrawlClientError, McpErrorCode } from '../../src/errors/mcp-errors.ts';
import { FirecrawlClient, type FirecrawlClientOps } from '../../src/services/firecrawl-client.ts';
import { AppLoggerLive } from '../../src/services/logger.ts';
import { AppMetricsLive } from '../../src/services/metrics.ts';
import { RateLimiterLive } from '../../src/services/rate-limiter.ts';

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

const _not_configured = (): Effect.Effect<never, FirecrawlClientError> =>
  Effect.fail(
    new FirecrawlClientError({
      message: 'Mock client: method not configured',
      cause: new Error('not configured'),
      code: McpErrorCode.firecrawl_error
    })
  );

/**
 * Builds a FirecrawlClientOps where every method fails unless overridden.
 * Use overrides to configure only the methods a specific test exercises.
 */
export function make_mock_client(overrides: Partial<FirecrawlClientOps>): FirecrawlClientOps {
  return {
    scrape: () => _not_configured(),
    map: () => _not_configured(),
    search: () => _not_configured(),
    crawl: () => _not_configured(),
    get_crawl_status: () => _not_configured(),
    extract: () => _not_configured(),
    start_agent: () => _not_configured(),
    get_agent_status: () => _not_configured(),
    browser_create: () => _not_configured(),
    browser_execute: () => _not_configured(),
    browser_delete: () => _not_configured(),
    browser_list: () => _not_configured(),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Layer factory
// ---------------------------------------------------------------------------

/**
 * Builds a full AppLive-equivalent layer substituting the given mock client.
 * Reads configuration from process.env; set env vars before calling.
 */
export function make_test_layer(
  mock_client: FirecrawlClientOps
): Layer.Layer<
  | import('../../src/config/app-config.ts').AppConfig
  | import('../../src/services/logger.ts').AppLogger
  | import('../../src/services/metrics.ts').AppMetrics
  | import('../../src/services/firecrawl-client.ts').FirecrawlClient
  | import('../../src/services/rate-limiter.ts').RateLimiter,
  ConfigError.ConfigError
> {
  const MockFirecrawlClientLayer = Layer.succeed(FirecrawlClient, mock_client);
  return Layer.mergeAll(
    AppConfigLive,
    AppLoggerLive.pipe(Layer.provide(AppConfigLive)),
    AppMetricsLive,
    RateLimiterLive.pipe(Layer.provide(AppConfigLive)),
    MockFirecrawlClientLayer
  );
}

// ---------------------------------------------------------------------------
// Environment helper
// ---------------------------------------------------------------------------

/**
 * Wraps a test function with process.env overrides, restoring originals afterward
 * regardless of whether the test passes or throws.
 */
export async function with_env(overrides: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
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
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

/**
 * Builds a runtime from the given mock client (reading env from process.env),
 * fires a POST through handle_web_request, and returns the parsed JSON response.
 *
 * Creates and disposes its own runtime — use this for tests where each call is
 * independent (different clients, different config). For tests that need shared
 * rate-limit or metric state across multiple requests, use make_runtime_request.
 */
export async function mock_request(
  body: unknown,
  mock_client: FirecrawlClientOps,
  extra_headers: Record<string, string> = {}
): Promise<{ readonly status: number, readonly json: Record<string, unknown> }> {
  const layer = make_test_layer(mock_client);
  const runtime = ManagedRuntime.make(layer);
  try {
    return await runtime_request(runtime, body, extra_headers);
  } finally {
    await runtime.dispose();
  }
}

/**
 * Fires a single POST through handle_web_request using a caller-managed runtime.
 * Use this when multiple requests must share state (e.g., in-memory rate limiter).
 */
export async function runtime_request(
  runtime: ManagedRuntime.ManagedRuntime<
    | import('../../src/config/app-config.ts').AppConfig
    | import('../../src/services/logger.ts').AppLogger
    | import('../../src/services/metrics.ts').AppMetrics
    | import('../../src/services/firecrawl-client.ts').FirecrawlClient
    | import('../../src/services/rate-limiter.ts').RateLimiter,
    unknown
  >,
  body: unknown,
  extra_headers: Record<string, string> = {}
): Promise<{ readonly status: number, readonly json: Record<string, unknown> }> {
  const request = new Request('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extra_headers },
    body: JSON.stringify(body)
  });
  const response = await runtime.runPromise(handle_web_request(request));
  const json = await response.json() as Record<string, unknown>;
  return { status: response.status, json };
}
