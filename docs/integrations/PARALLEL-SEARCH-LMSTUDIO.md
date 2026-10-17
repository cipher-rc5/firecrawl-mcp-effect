# Optional Parallel Search in LM Studio

Use [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp) to discover pages, then scrape selected URLs with this Firecrawl server in the same LM Studio chat. Parallel provides free web search and page fetching without an account or API key; anonymous search uses Fast mode and has usage limits.

Firecrawl already includes `firecrawl_search`. This setup adds an optional companion for users who want Parallel for discovery while keeping Firecrawl for scraping, crawling, and structured extraction. The two servers connect independently to LM Studio.

## Prerequisites

- Complete the [Firecrawl LM Studio setup](../lmstudio-integration.md) first.
- Use LM Studio 0.3.17 (build 10) or later, which supports [remote MCP servers](https://lmstudio.ai/docs/app/mcp), and a model that supports tool use.
- Have an internet connection for Parallel. Your existing Firecrawl credentials or self-hosted configuration are still needed for Firecrawl operations.

## Add the companion server

In LM Studio, open **Program → Install → Edit mcp.json**. Add `parallel-search` inside your existing `mcpServers` object. Keep your existing `firecrawl` entry, credentials, environment settings, and any other servers.

For a new configuration, this combines the Firecrawl setup from the integration guide with Parallel:

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": ["run", "/FULL/PATH/TO/firecrawl-mcp-effect/src/stdio-server.ts"],
      "env": { "FIRECRAWL_API_KEY": "your-firecrawl-api-key-here", "SAFE_MODE": "true", "MCP_VERSION": "2024-11-05" }
    },
    "parallel-search": {
      "url": "https://search.parallel.ai/mcp",
      "headers": { "User-Agent": "firecrawl-mcp-effect/0.1.0 (LM Studio)" }
    }
  }
}
```

Replace the absolute project path and Firecrawl key before saving. Parallel connects over Streamable HTTP; Firecrawl continues to run locally over stdio. No Parallel key or authorization header is needed for this anonymous endpoint. The `MCP_VERSION` setting belongs to the local Firecrawl process; LM Studio negotiates with Parallel separately.

Save the file and reload the servers, or restart LM Studio if the new tools do not appear.

## Verify and use it

1. Inspect LM Studio's available tools. The `parallel-search` server should expose `web_search` and `web_fetch`, alongside the existing Firecrawl tools such as `firecrawl_scrape` and `firecrawl_search`.
2. Ask: **"Use Parallel's web_search to find the official Bun installation documentation. Show the source URLs."** Check the tool call to confirm which server was used.
3. Choose a returned URL and ask: **"Use Firecrawl's firecrawl_scrape on this URL to extract its main content as Markdown: [paste the URL]. Summarize the installation steps and cite the URL."** Check that the call uses `firecrawl_scrape`.

For a short page excerpt instead, ask for Parallel's `web_fetch` on a selected URL. Use Firecrawl when you need its scraping options, crawling, or structured extraction. Tool selection depends on your model and enabled tools, so name the server and tool explicitly when checking this workflow.

## Troubleshooting

- **No Parallel tools:** Check that `parallel-search` is inside the existing `mcpServers` object, that the JSON has no trailing commas, and that the URL ends in `/mcp`. Check LM Studio's server logs and confirm remote MCP support in your installed version.
- **The wrong search tool runs:** Name Parallel's `web_search` or Firecrawl's `firecrawl_search` explicitly and inspect the tool call.
- **Parallel returns a usage limit:** Wait before retrying. Free anonymous access has limits; see the [Parallel setup guide](https://docs.parallel.ai/integrations/mcp/search-mcp) for authenticated access with higher limits.
- **Firecrawl fails after search succeeds:** Check the existing Firecrawl server logs and credentials using the [Firecrawl troubleshooting steps](../lmstudio-integration.md#troubleshooting). Each server has its own connection and authentication settings.

Search queries and fetched URLs are sent to the selected service. Enable only servers you intend to use for the current task.
