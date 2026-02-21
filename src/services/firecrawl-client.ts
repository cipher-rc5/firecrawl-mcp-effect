// file: src/services/firecrawl-client.ts
// description: Effect service layer wrapping @mendable/firecrawl-js with typed errors and secret handling
// reference: https://effect.website/docs/guides/context-management/layers

import FirecrawlApp from '@mendable/firecrawl-js';
import type { AgentResponse, AgentStatusResponse } from '@mendable/firecrawl-js';
import { Context, Effect, Layer, Redacted } from 'effect';
import { AppConfig } from '../config/app-config.ts';
import { configuration_error, type ConfigurationError, type FirecrawlClientError, unauthorized, type UnauthorizedError } from '../errors/mcp-errors.ts';
import { classified_firecrawl_error } from '../lib/upstream-classifier.ts';

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

  readonly start_agent: (body: Record<string, unknown>) => Effect.Effect<AgentResponse, FirecrawlClientError>;

  readonly get_agent_status: (id: string) => Effect.Effect<AgentStatusResponse, FirecrawlClientError>;

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
  return Effect.tryPromise({ try: fn, catch: (cause) => classified_firecrawl_error(label, cause) });
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
      // Body is pre-validated by the tool schema layer; cast through unknown to satisfy
      // the typed SDK signature without the blanket `any` that was here before.
      app.startAgent({ ...body, origin: ORIGIN } as unknown as Parameters<typeof app.startAgent>[0])),

    get_agent_status: (id) => wrap('getAgentStatus', () => app.getAgentStatus(id)),

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

      if (config.cloud_service) {
        // In cloud mode the API key comes from the request header; each request
        // builds its own client via make_request_client. Install a stub so the
        // layer graph builds cleanly without requiring credentials at startup.
        return cloud_stub_ops();
      }

      // Self-hosted path: validate that at least one credential is present
      if (config.firecrawl_api_key === undefined && config.firecrawl_api_url === undefined) {
        return yield* Effect.fail(
          configuration_error('Either FIRECRAWL_API_KEY or FIRECRAWL_API_URL must be provided')
        );
      }

      const api_key = config.firecrawl_api_key !== undefined ? Redacted.value(config.firecrawl_api_key) : undefined;

      const app = build_app(api_key, config.firecrawl_api_url);
      return build_ops(app);
    })
  );

// ---------------------------------------------------------------------------
// Cloud-mode stub — satisfies the layer graph without constructing a real app
// ---------------------------------------------------------------------------

/**
 * Returns a FirecrawlClientOps whose methods all die with a bug marker.
 * In cloud mode the service-layer slot is never accessed at runtime — each
 * request resolves its own client via make_request_client — so this stub only
 * exists to keep the Effect layer graph well-typed.
 */
function cloud_stub_ops(): FirecrawlClientOps {
  const unreachable = Effect.die(new Error('BUG: FirecrawlClient stub called in cloud mode'));
  return {
    scrape: () => unreachable,
    map: () => unreachable,
    search: () => unreachable,
    crawl: () => unreachable,
    get_crawl_status: () => unreachable,
    extract: () => unreachable,
    start_agent: () => unreachable,
    get_agent_status: () => unreachable,
    browser_create: () => unreachable,
    browser_execute: () => unreachable,
    browser_delete: () => unreachable,
    browser_list: () => unreachable
  };
}

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
