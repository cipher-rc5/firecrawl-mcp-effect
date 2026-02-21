// file: src/services/firecrawl-client.ts
// description: Effect service layer wrapping @mendable/firecrawl-js with typed errors and secret handling
// reference: https://effect.website/docs/guides/context-management/layers

import FirecrawlApp from '@mendable/firecrawl-js';
import { Context, Effect, Layer, Redacted } from 'effect';
import { AppConfig } from '../config/app-config.ts';
import { configuration_error, type ConfigurationError, firecrawl_error, type FirecrawlClientError, unauthorized, type UnauthorizedError } from '../errors/mcp-errors.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORIGIN = 'mcp-effect' as const;
const DEFAULT_API_URL = 'https://api.firecrawl.dev' as const;

// ---------------------------------------------------------------------------
// FirecrawlClient interface — all public operations
// ---------------------------------------------------------------------------

/**
 * Public client operations consumed by tool handlers.
 */
export interface FirecrawlClientOps {
  readonly scrape: (url: string, options: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly map: (url: string, options: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly search: (query: string, options: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly crawl: (url: string, options: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly get_crawl_status: (id: string) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly extract: (body: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly start_agent: (body: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly get_agent_status: (id: string) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly browser_create: (options: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly browser_execute: (
    session_id: string,
    body: Record<string, unknown>
  ) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly browser_delete: (session_id: string) => Effect.Effect<unknown, FirecrawlClientError>;

  readonly browser_list: (options: Record<string, unknown>) => Effect.Effect<unknown, FirecrawlClientError>;
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

export class FirecrawlClient extends Context.Tag('FirecrawlClient')<FirecrawlClient, FirecrawlClientOps>() {}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function build_app(api_key: string | undefined, api_url: string | undefined): FirecrawlApp {
  return new FirecrawlApp({
    apiUrl: api_url ?? DEFAULT_API_URL,
    ...(api_key !== undefined ? { apiKey: api_key } : {})
  });
}

function wrap<T>(label: string, fn: () => Promise<T>): Effect.Effect<T, FirecrawlClientError> {
  return Effect.tryPromise({ try: fn, catch: (cause) => firecrawl_error(`Firecrawl ${label} failed`, cause) });
}

function build_ops(app: FirecrawlApp): FirecrawlClientOps {
  return {
    scrape: (url, options) => wrap('scrape', () => app.scrape(url, { ...options, origin: ORIGIN } as never)),

    map: (url, options) => wrap('map', () => app.map(url, { ...options, origin: ORIGIN } as never)),

    search: (query, options) => wrap('search', () => app.search(query, { ...options, origin: ORIGIN } as never)),

    crawl: (url, options) => wrap('crawl', () => app.crawl(url, { ...options, origin: ORIGIN } as never)),

    get_crawl_status: (id) => wrap('getCrawlStatus', () => app.getCrawlStatus(id)),

    extract: (body) => wrap('extract', () => app.extract({ ...body, origin: ORIGIN } as never)),

    start_agent: (body) => wrap('startAgent', () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (app as any).startAgent({ ...body, origin: ORIGIN })),

    get_agent_status: (id) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wrap('getAgentStatus', () => (app as any).getAgentStatus(id)),

    browser_create: (options) => wrap('browser', () => app.browser(options as never)),

    browser_execute: (session_id, body) => wrap('browserExecute', () => app.browserExecute(session_id, body as never)),

    browser_delete: (session_id) => wrap('deleteBrowser', () => app.deleteBrowser(session_id)),

    browser_list: (options) => wrap('listBrowsers', () => app.listBrowsers(options as never))
  };
}

// ---------------------------------------------------------------------------
// Layer — resolves API key / URL from config; validates presence
// ---------------------------------------------------------------------------

export const FirecrawlClientLive: Layer.Layer<FirecrawlClient, ConfigurationError | UnauthorizedError, AppConfig> =
  Layer.effect(
    FirecrawlClient,
    Effect.gen(function*() {
      const config = yield* AppConfig;

      if (!config.cloud_service) {
        // Self-hosted path: validate that at least one credential is present
        if (config.firecrawl_api_key === undefined && config.firecrawl_api_url === undefined) {
          return yield* Effect.fail(
            configuration_error('Either FIRECRAWL_API_KEY or FIRECRAWL_API_URL must be provided')
          );
        }
      }

      const api_key = config.firecrawl_api_key !== undefined ? Redacted.value(config.firecrawl_api_key) : undefined;

      const app = build_app(api_key, config.firecrawl_api_url);
      return build_ops(app);
    })
  );

// ---------------------------------------------------------------------------
// Per-request factory — used in cloud mode where the key comes from a header
// ---------------------------------------------------------------------------

/**
 * Creates a per-request Firecrawl client (used in cloud-service mode).
 */
export function make_request_client(api_key: string, api_url: string | undefined): FirecrawlClientOps {
  const app = build_app(api_key, api_url);
  return build_ops(app);
}

// ---------------------------------------------------------------------------
// Helper to resolve client from service OR per-request key
// ---------------------------------------------------------------------------

/**
 * Resolves client operations from either a shared service or request header key.
 */
export function get_client(
  header_key: string | undefined,
  cloud_service: boolean,
  api_url: string | undefined
): Effect.Effect<FirecrawlClientOps, UnauthorizedError | FirecrawlClientError, FirecrawlClient> {
  if (cloud_service) {
    if (header_key === undefined || header_key.trim() === '') {
      return Effect.fail(unauthorized('Firecrawl API key is required'));
    }
    return Effect.succeed(make_request_client(header_key, api_url));
  }
  return FirecrawlClient;
}
