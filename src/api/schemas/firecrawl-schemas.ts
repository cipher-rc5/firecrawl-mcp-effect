// file: src/api/schemas/firecrawl-schemas.ts
// description: Effect Schema definitions for all Firecrawl tool parameters and MCP wire types
// reference: https://effect.website/docs/schema/introduction

import { Schema } from 'effect';

// ---------------------------------------------------------------------------
// Primitives shared across tools
// ---------------------------------------------------------------------------

/** Supported proxy modes accepted by Firecrawl endpoints. */
export const Proxy = Schema.Literal('basic', 'stealth', 'enhanced', 'auto');

/** Supported scrape output format descriptors. */
export const ScrapeFormat = Schema.Union(
  Schema.Literal('markdown', 'html', 'rawHtml', 'screenshot', 'links', 'summary', 'changeTracking', 'branding'),
  Schema.Struct({
    type: Schema.Literal('json'),
    prompt: Schema.optional(Schema.String),
    schema: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
  }),
  Schema.Struct({
    type: Schema.Literal('screenshot'),
    fullPage: Schema.optional(Schema.Boolean),
    quality: Schema.optional(Schema.Number),
    viewport: Schema.optional(Schema.Struct({ width: Schema.Number, height: Schema.Number }))
  })
);

/** Supported parser configurations for scrape operations. */
export const Parser = Schema.Union(
  Schema.Literal('pdf'),
  Schema.Struct({
    type: Schema.Literal('pdf'),
    maxPages: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 10000)))
  })
);

/** Safe-mode-compatible action types. */
export const SafeActionType = Schema.Literal('wait', 'screenshot', 'scroll', 'scrape');

/** Full action set for non-safe-mode browser interaction. */
export const FullActionType = Schema.Union(
  SafeActionType,
  Schema.Literal('click', 'write', 'press', 'executeJavascript', 'generatePDF')
);

/** Browser action payload accepted by scrape actions. */
export const Action = Schema.Struct({
  type: FullActionType,
  selector: Schema.optional(Schema.String),
  milliseconds: Schema.optional(Schema.Number),
  text: Schema.optional(Schema.String),
  key: Schema.optional(Schema.String),
  direction: Schema.optional(Schema.Literal('up', 'down')),
  script: Schema.optional(Schema.String),
  fullPage: Schema.optional(Schema.Boolean)
});

/** Optional geolocation and language hints for scraping. */
export const LocationOptions = Schema.Struct({
  country: Schema.optional(Schema.String),
  languages: Schema.optional(Schema.Array(Schema.String))
});

// ---------------------------------------------------------------------------
// MCP wire types
// ---------------------------------------------------------------------------

/** MCP JSON-RPC request envelope schema. */
export const McpRequest = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.Union(Schema.String, Schema.Number, Schema.Null),
  method: Schema.String,
  params: Schema.optional(Schema.Unknown)
});
/** Inferred TypeScript type for a validated MCP request envelope. */
export type McpRequest = Schema.Schema.Type<typeof McpRequest>;

/** MCP JSON-RPC response envelope schema. */
export const McpResponse = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.Union(Schema.String, Schema.Number, Schema.Null),
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(
    Schema.Struct({ code: Schema.Number, message: Schema.String, data: Schema.optional(Schema.Unknown) })
  )
});
/** Inferred TypeScript type for a validated MCP response envelope. */
export type McpResponse = Schema.Schema.Type<typeof McpResponse>;

// ---------------------------------------------------------------------------
// Tool-specific parameter schemas
// ---------------------------------------------------------------------------

/** Parameters accepted by `firecrawl_scrape`. */
export const ScrapeParams = Schema.Struct({
  url: Schema.String.pipe(Schema.pattern(/^https?:\/\//)),
  formats: Schema.optional(Schema.Array(ScrapeFormat)),
  parsers: Schema.optional(Schema.Array(Parser)),
  onlyMainContent: Schema.optional(Schema.Boolean),
  includeTags: Schema.optional(Schema.Array(Schema.String)),
  excludeTags: Schema.optional(Schema.Array(Schema.String)),
  waitFor: Schema.optional(Schema.Number),
  actions: Schema.optional(Schema.Array(Action)),
  mobile: Schema.optional(Schema.Boolean),
  skipTlsVerification: Schema.optional(Schema.Boolean),
  removeBase64Images: Schema.optional(Schema.Boolean),
  location: Schema.optional(LocationOptions),
  storeInCache: Schema.optional(Schema.Boolean),
  zeroDataRetention: Schema.optional(Schema.Boolean),
  maxAge: Schema.optional(Schema.Number),
  proxy: Schema.optional(Proxy)
});
/** Inferred TypeScript type for `firecrawl_scrape` parameters. */
export type ScrapeParams = Schema.Schema.Type<typeof ScrapeParams>;

/** Parameters accepted by `firecrawl_map`. */
export const MapParams = Schema.Struct({
  url: Schema.String.pipe(Schema.pattern(/^https?:\/\//)),
  search: Schema.optional(Schema.String),
  sitemap: Schema.optional(Schema.Literal('include', 'skip', 'only')),
  includeSubdomains: Schema.optional(Schema.Boolean),
  limit: Schema.optional(Schema.Number),
  ignoreQueryParameters: Schema.optional(Schema.Boolean)
});
/** Inferred TypeScript type for `firecrawl_map` parameters. */
export type MapParams = Schema.Schema.Type<typeof MapParams>;

/** Parameters accepted by `firecrawl_search`. */
export const SearchParams = Schema.Struct({
  query: Schema.String.pipe(Schema.minLength(1)),
  limit: Schema.optional(Schema.Number),
  tbs: Schema.optional(Schema.String),
  filter: Schema.optional(Schema.String),
  location: Schema.optional(Schema.String),
  sources: Schema.optional(Schema.Array(Schema.Struct({ type: Schema.Literal('web', 'images', 'news') }))),
  scrapeOptions: Schema.optional(
    Schema.Struct({
      formats: Schema.optional(Schema.Array(ScrapeFormat)),
      onlyMainContent: Schema.optional(Schema.Boolean)
    })
  ),
  enterprise: Schema.optional(Schema.Array(Schema.Literal('default', 'anon', 'zdr')))
});
/** Inferred TypeScript type for `firecrawl_search` parameters. */
export type SearchParams = Schema.Schema.Type<typeof SearchParams>;

/** Parameters accepted by `firecrawl_crawl`. */
export const CrawlParams = Schema.Struct({
  url: Schema.String,
  prompt: Schema.optional(Schema.String),
  excludePaths: Schema.optional(Schema.Array(Schema.String)),
  includePaths: Schema.optional(Schema.Array(Schema.String)),
  maxDiscoveryDepth: Schema.optional(Schema.Number),
  sitemap: Schema.optional(Schema.Literal('skip', 'include', 'only')),
  limit: Schema.optional(Schema.Number),
  allowExternalLinks: Schema.optional(Schema.Boolean),
  allowSubdomains: Schema.optional(Schema.Boolean),
  crawlEntireDomain: Schema.optional(Schema.Boolean),
  delay: Schema.optional(Schema.Number),
  maxConcurrency: Schema.optional(Schema.Number),
  deduplicateSimilarURLs: Schema.optional(Schema.Boolean),
  ignoreQueryParameters: Schema.optional(Schema.Boolean),
  scrapeOptions: Schema.optional(
    Schema.Struct({
      formats: Schema.optional(Schema.Array(ScrapeFormat)),
      onlyMainContent: Schema.optional(Schema.Boolean)
    })
  ),
  webhook: Schema.optional(
    Schema.Union(
      Schema.String,
      Schema.Struct({
        url: Schema.String,
        headers: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String }))
      })
    )
  )
});
/** Inferred TypeScript type for `firecrawl_crawl` parameters. */
export type CrawlParams = Schema.Schema.Type<typeof CrawlParams>;

/** Parameters accepted by `firecrawl_check_crawl_status`. */
export const CrawlStatusParams = Schema.Struct({ id: Schema.String });
/** Inferred TypeScript type for crawl status parameters. */
export type CrawlStatusParams = Schema.Schema.Type<typeof CrawlStatusParams>;

/** Parameters accepted by `firecrawl_extract`. */
export const ExtractParams = Schema.Struct({
  urls: Schema.Array(Schema.String),
  prompt: Schema.optional(Schema.String),
  schema: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  allowExternalLinks: Schema.optional(Schema.Boolean),
  enableWebSearch: Schema.optional(Schema.Boolean),
  includeSubdomains: Schema.optional(Schema.Boolean)
});
/** Inferred TypeScript type for `firecrawl_extract` parameters. */
export type ExtractParams = Schema.Schema.Type<typeof ExtractParams>;

/** Parameters accepted by `firecrawl_agent`. */
export const AgentParams = Schema.Struct({
  prompt: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(10000)),
  urls: Schema.optional(Schema.Array(Schema.String)),
  schema: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
});
/** Inferred TypeScript type for `firecrawl_agent` parameters. */
export type AgentParams = Schema.Schema.Type<typeof AgentParams>;

/** Parameters accepted by `firecrawl_agent_status`. */
export const AgentStatusParams = Schema.Struct({ id: Schema.String });
/** Inferred TypeScript type for agent status parameters. */
export type AgentStatusParams = Schema.Schema.Type<typeof AgentStatusParams>;

/** Parameters accepted by `firecrawl_browser_create`. */
export const BrowserCreateParams = Schema.Struct({
  ttl: Schema.optional(Schema.Number.pipe(Schema.between(30, 3600))),
  activityTtl: Schema.optional(Schema.Number.pipe(Schema.between(10, 3600))),
  streamWebView: Schema.optional(Schema.Boolean)
});
/** Inferred TypeScript type for browser create parameters. */
export type BrowserCreateParams = Schema.Schema.Type<typeof BrowserCreateParams>;

/** Parameters accepted by `firecrawl_browser_execute`. */
export const BrowserExecuteParams = Schema.Struct({
  sessionId: Schema.String,
  code: Schema.String,
  language: Schema.optional(Schema.Literal('bash', 'python', 'node'))
});
/** Inferred TypeScript type for browser execute parameters. */
export type BrowserExecuteParams = Schema.Schema.Type<typeof BrowserExecuteParams>;

/** Parameters accepted by `firecrawl_browser_delete`. */
export const BrowserDeleteParams = Schema.Struct({ sessionId: Schema.String });
/** Inferred TypeScript type for browser delete parameters. */
export type BrowserDeleteParams = Schema.Schema.Type<typeof BrowserDeleteParams>;

/** Parameters accepted by `firecrawl_browser_list`. */
export const BrowserListParams = Schema.Struct({ status: Schema.optional(Schema.Literal('active', 'destroyed')) });
/** Inferred TypeScript type for browser list parameters. */
export type BrowserListParams = Schema.Schema.Type<typeof BrowserListParams>;
