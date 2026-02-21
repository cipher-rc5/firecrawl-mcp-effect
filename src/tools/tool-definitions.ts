// file: src/tools/tool-definitions.ts
// description: Static tool metadata returned by tools/list — decoupled from handler logic
// reference: https://spec.modelcontextprotocol.io/specification/server/tools/

/**
 * MCP tool metadata shape returned by `tools/list`.
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: 'object',
    readonly properties: Record<string, unknown>,
    readonly required?: ReadonlyArray<string>
  };
}

/**
 * Canonical list of tool definitions exposed by this server.
 */
export const TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [{
  name: 'firecrawl_scrape',
  description:
    'Scrape content from a single URL. Supports markdown, html, rawHtml, screenshot, links, summary, branding, and JSON extraction formats. Use JSON format with a schema for specific structured data extraction. Use markdown only when you need the entire page content.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri', description: 'URL to scrape' },
      formats: { type: 'array', description: 'Output formats to return' },
      onlyMainContent: { type: 'boolean', description: 'Strip nav/footer' },
      includeTags: { type: 'array', items: { type: 'string' } },
      excludeTags: { type: 'array', items: { type: 'string' } },
      waitFor: { type: 'number', description: 'MS to wait for JS render' },
      actions: { type: 'array', description: 'Browser actions (non-safe mode only)' },
      mobile: { type: 'boolean' },
      skipTlsVerification: { type: 'boolean' },
      removeBase64Images: { type: 'boolean' },
      location: {
        type: 'object',
        properties: { country: { type: 'string' }, languages: { type: 'array', items: { type: 'string' } } }
      },
      storeInCache: { type: 'boolean' },
      zeroDataRetention: { type: 'boolean' },
      maxAge: { type: 'number', description: 'Max cache age in seconds' },
      proxy: { type: 'string', enum: ['basic', 'stealth', 'enhanced', 'auto'] }
    },
    required: ['url']
  }
}, {
  name: 'firecrawl_map',
  description:
    'Discover all indexed URLs on a site. Use the search parameter to filter results by keyword. Prefer this over firecrawl_agent when scrape returns empty results.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri' },
      search: { type: 'string' },
      sitemap: { type: 'string', enum: ['include', 'skip', 'only'] },
      includeSubdomains: { type: 'boolean' },
      limit: { type: 'number' },
      ignoreQueryParameters: { type: 'boolean' }
    },
    required: ['url']
  }
}, {
  name: 'firecrawl_search',
  description:
    'Search the web and optionally scrape result pages. Supports web, images, and news sources. Best for finding information across multiple sites.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', minLength: 1 },
      limit: { type: 'number' },
      tbs: { type: 'string' },
      filter: { type: 'string' },
      location: { type: 'string' },
      sources: {
        type: 'array',
        items: { type: 'object', properties: { type: { type: 'string', enum: ['web', 'images', 'news'] } } }
      },
      scrapeOptions: { type: 'object' },
      enterprise: { type: 'array', items: { type: 'string', enum: ['default', 'anon', 'zdr'] } }
    },
    required: ['query']
  }
}, {
  name: 'firecrawl_crawl',
  description:
    'Start an async crawl job across multiple pages of a site. Returns a job ID. Poll firecrawl_check_crawl_status for results. Limit depth and page count to avoid token overflow.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      maxDiscoveryDepth: { type: 'number' },
      limit: { type: 'number' },
      includePaths: { type: 'array', items: { type: 'string' } },
      excludePaths: { type: 'array', items: { type: 'string' } },
      allowExternalLinks: { type: 'boolean' },
      allowSubdomains: { type: 'boolean' },
      deduplicateSimilarURLs: { type: 'boolean' },
      ignoreQueryParameters: { type: 'boolean' },
      sitemap: { type: 'string', enum: ['skip', 'include', 'only'] },
      scrapeOptions: { type: 'object' },
      webhook: { oneOf: [{ type: 'string' }, { type: 'object' }] }
    },
    required: ['url']
  }
}, {
  name: 'firecrawl_check_crawl_status',
  description: 'Check the status and retrieve results of a crawl job by ID.',
  inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
}, {
  name: 'firecrawl_extract',
  description:
    'Extract structured data from one or more URLs using LLM capabilities. Provide a prompt and optional JSON schema for typed output.',
  inputSchema: {
    type: 'object',
    properties: {
      urls: { type: 'array', items: { type: 'string' } },
      prompt: { type: 'string' },
      schema: { type: 'object' },
      allowExternalLinks: { type: 'boolean' },
      enableWebSearch: { type: 'boolean' },
      includeSubdomains: { type: 'boolean' }
    },
    required: ['urls']
  }
}, {
  name: 'firecrawl_agent',
  description:
    'Async autonomous web research agent. Describe what you need in natural language. Returns a job ID immediately — poll firecrawl_agent_status every 15-30s for up to 5 minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', minLength: 1, maxLength: 10000 },
      urls: { type: 'array', items: { type: 'string', format: 'uri' } },
      schema: { type: 'object' }
    },
    required: ['prompt']
  }
}, {
  name: 'firecrawl_agent_status',
  description: 'Check the status of an agent job. Keep polling every 15-30s until status is completed or failed.',
  inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
}, {
  name: 'firecrawl_browser_create',
  description: 'Create a persistent browser session for CDP-based automation. Returns a session ID and live view URL.',
  inputSchema: {
    type: 'object',
    properties: {
      ttl: { type: 'number', minimum: 30, maximum: 3600 },
      activityTtl: { type: 'number', minimum: 10, maximum: 3600 },
      streamWebView: { type: 'boolean' }
    }
  }
}, {
  name: 'firecrawl_browser_execute',
  description:
    'Execute bash (agent-browser commands), Python, or Node.js code in an active browser session. Requires a session ID from firecrawl_browser_create. Disabled in safe mode.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      code: { type: 'string' },
      language: { type: 'string', enum: ['bash', 'python', 'node'] }
    },
    required: ['sessionId', 'code']
  }
}, {
  name: 'firecrawl_browser_delete',
  description: 'Destroy a browser session and release its resources.',
  inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] }
}, {
  name: 'firecrawl_browser_list',
  description: 'List browser sessions, optionally filtered by status.',
  inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'destroyed'] } } }
}];
