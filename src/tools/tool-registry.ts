// file: src/tools/tool-registry.ts
// description: Central registry mapping MCP tool names to Effect-typed handlers with schema validation
// reference: https://effect.website/docs/guides/context-management/services

import { Effect, Schema } from 'effect';
import { AppConfig } from '../config/app-config.ts';
import { invalid_params, type InvalidParamsError, type McpDomainError, tool_not_found, type ToolNotFoundError } from '../errors/mcp-errors.ts';
import { as_text, remove_empty_top_level } from '../lib/utils.ts';
import { type FirecrawlClientOps } from '../services/firecrawl-client.ts';
import { AppLogger } from '../services/logger.ts';
import { AgentParamsSchema, AgentStatusParamsSchema, BrowserCreateParamsSchema, BrowserDeleteParamsSchema, BrowserExecuteParamsSchema, BrowserListParamsSchema, CrawlParamsSchema, CrawlStatusParamsSchema, ExtractParamsSchema, MapParamsSchema, ScrapeParamsSchema, SearchParamsSchema } from './tool-schemas.ts';

// ---------------------------------------------------------------------------
// Tool handler type
// ---------------------------------------------------------------------------

/**
 * Type for executable MCP tool handlers after parameter validation.
 */
export type ToolHandler = (
  raw_params: unknown,
  client: FirecrawlClientOps,
  safe_mode: boolean
) => Effect.Effect<string, McpDomainError, AppLogger | AppConfig>;

// ---------------------------------------------------------------------------
// Helper: decode params with Schema
// ---------------------------------------------------------------------------

function decode<A, I>(schema: Schema.Schema<A, I, never>, raw: unknown): Effect.Effect<A, InvalidParamsError> {
  return Schema.decodeUnknown(schema)(raw).pipe(
    Effect.mapError((e) => invalid_params(typeof e.message === 'string' ? e.message : 'Invalid tool parameters'))
  );
}

// ---------------------------------------------------------------------------
// Individual tool handlers
// ---------------------------------------------------------------------------

const handle_scrape: ToolHandler = (raw, client, safe_mode) =>
  Effect.gen(function*() {
    const params = yield* decode(ScrapeParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:scrape', { url: params.url });

    const { url, ...rest } = params;

    // In safe mode, strip actions
    const options = safe_mode ? remove_empty_top_level({ ...rest, actions: undefined }) : remove_empty_top_level(rest);

    const result = yield* client.scrape(url, options);
    return as_text(result);
  });

const handle_map: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(MapParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:map', { url: params.url });

    const { url, ...rest } = params;
    const result = yield* client.map(url, remove_empty_top_level(rest));
    return as_text(result);
  });

const handle_search: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(SearchParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:search', { query: params.query });

    const { query, ...rest } = params;
    const result = yield* client.search(query, remove_empty_top_level(rest));
    return as_text(result);
  });

const handle_crawl: ToolHandler = (raw, client, safe_mode) =>
  Effect.gen(function*() {
    const params = yield* decode(CrawlParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:crawl', { url: params.url });

    const { url, ...rest } = params;
    const options = safe_mode ? remove_empty_top_level({ ...rest, webhook: undefined }) : remove_empty_top_level(rest);

    const result = yield* client.crawl(url, options);
    return as_text(result);
  });

const handle_check_crawl_status: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(CrawlStatusParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:check_crawl_status', { id: params.id });

    const result = yield* client.get_crawl_status(params.id);
    return as_text(result);
  });

const handle_extract: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(ExtractParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:extract', { url_count: params.urls.length });

    const result = yield* client.extract(remove_empty_top_level(params));
    return as_text(result);
  });

const handle_agent: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(AgentParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:agent', { prompt_len: params.prompt.length });

    const result = yield* client.start_agent(remove_empty_top_level(params));
    return as_text(result);
  });

const handle_agent_status: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(AgentStatusParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:agent_status', { id: params.id });

    const result = yield* client.get_agent_status(params.id);
    return as_text(result);
  });

const handle_browser_create: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(BrowserCreateParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:browser_create');

    const result = yield* client.browser_create(remove_empty_top_level(params));
    return as_text(result);
  });

const handle_browser_execute: ToolHandler = (raw, client, safe_mode) =>
  Effect.gen(function*() {
    if (safe_mode) {
      return yield* Effect.fail(invalid_params('firecrawl_browser_execute is disabled in safe mode'));
    }
    const params = yield* decode(BrowserExecuteParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:browser_execute', { session_id: params.sessionId });

    const result = yield* client.browser_execute(params.sessionId, {
      code: params.code,
      ...(params.language !== undefined ? { language: params.language } : {})
    });
    return as_text(result);
  });

const handle_browser_delete: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(BrowserDeleteParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:browser_delete', { session_id: params.sessionId });

    const result = yield* client.browser_delete(params.sessionId);
    return as_text(result);
  });

const handle_browser_list: ToolHandler = (raw, client) =>
  Effect.gen(function*() {
    const params = yield* decode(BrowserListParamsSchema, raw);
    const logger = yield* AppLogger;
    logger.info('tool:browser_list');

    const result = yield* client.browser_list(remove_empty_top_level(params));
    return as_text(result);
  });

// ---------------------------------------------------------------------------
// Registry map
// ---------------------------------------------------------------------------

const REGISTRY = new Map<string, ToolHandler>([
  ['firecrawl_scrape', handle_scrape],
  ['firecrawl_map', handle_map],
  ['firecrawl_search', handle_search],
  ['firecrawl_crawl', handle_crawl],
  ['firecrawl_check_crawl_status', handle_check_crawl_status],
  ['firecrawl_extract', handle_extract],
  ['firecrawl_agent', handle_agent],
  ['firecrawl_agent_status', handle_agent_status],
  ['firecrawl_browser_create', handle_browser_create],
  ['firecrawl_browser_execute', handle_browser_execute],
  ['firecrawl_browser_delete', handle_browser_delete],
  ['firecrawl_browser_list', handle_browser_list]
]);

// ---------------------------------------------------------------------------
// Public lookup
// ---------------------------------------------------------------------------

/**
 * Resolves a handler for a given MCP tool name.
 */
export function get_tool_handler(name: string): Effect.Effect<ToolHandler, ToolNotFoundError> {
  const handler = REGISTRY.get(name);
  if (handler === undefined) {
    return Effect.fail(tool_not_found(name));
  }
  return Effect.succeed(handler);
}

/**
 * Returns all registered tool names.
 */
export function list_tool_names(): ReadonlyArray<string> {
  return Array.from(REGISTRY.keys());
}
