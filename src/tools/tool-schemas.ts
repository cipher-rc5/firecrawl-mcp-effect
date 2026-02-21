// file: src/tools/tool-schemas.ts
// description: Schema re-exports aliased for the tool registry to avoid circular imports
// reference: https://effect.website/docs/schema/introduction

import { AgentParams, AgentStatusParams, BrowserCreateParams, BrowserDeleteParams, BrowserExecuteParams, BrowserListParams, CrawlParams, CrawlStatusParams, ExtractParams, MapParams, ScrapeParams, SearchParams } from '../api/schemas/firecrawl-schemas.ts';

/** Validated input schema for `firecrawl_scrape`. */
export const ScrapeParamsSchema = ScrapeParams;
/** Validated input schema for `firecrawl_map`. */
export const MapParamsSchema = MapParams;
/** Validated input schema for `firecrawl_search`. */
export const SearchParamsSchema = SearchParams;
/** Validated input schema for `firecrawl_crawl`. */
export const CrawlParamsSchema = CrawlParams;
/** Validated input schema for `firecrawl_check_crawl_status`. */
export const CrawlStatusParamsSchema = CrawlStatusParams;
/** Validated input schema for `firecrawl_extract`. */
export const ExtractParamsSchema = ExtractParams;
/** Validated input schema for `firecrawl_agent`. */
export const AgentParamsSchema = AgentParams;
/** Validated input schema for `firecrawl_agent_status`. */
export const AgentStatusParamsSchema = AgentStatusParams;
/** Validated input schema for `firecrawl_browser_create`. */
export const BrowserCreateParamsSchema = BrowserCreateParams;
/** Validated input schema for `firecrawl_browser_execute`. */
export const BrowserExecuteParamsSchema = BrowserExecuteParams;
/** Validated input schema for `firecrawl_browser_delete`. */
export const BrowserDeleteParamsSchema = BrowserDeleteParams;
/** Validated input schema for `firecrawl_browser_list`. */
export const BrowserListParamsSchema = BrowserListParams;
