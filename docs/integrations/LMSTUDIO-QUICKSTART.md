# LM Studio Quick Start

## Add Firecrawl MCP to LM Studio in 3 Steps

### 1. Get Your Project Path

```bash
cd /path/to/firecrawl-mcp-effect
pwd
```

Copy the output (e.g., `/Users/yourname/projects/firecrawl-mcp-effect`)

### 2. Configure LM Studio

Open LM Studio → Program tab → Install → Edit mcp.json

Add this (replace `/FULL/PATH/TO/...` with your path from step 1):

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": [
        "run",
        "/FULL/PATH/TO/firecrawl-mcp-effect/src/stdio-server.ts"
      ],
      "env": {
        "FIRECRAWL_API_KEY": "your-firecrawl-api-key-here",
        "MCP_VERSION": "2024-11-05"
      }
    }
  }
}
```

 **Important:** Must include `"MCP_VERSION": "2024-11-05"` — LM Studio doesn't support 2025-11-25 yet!

### 3. Test It

In LM Studio chat, ask:

> "Can you scrape https://example.com?"

The AI should use the `firecrawl_scrape` tool automatically!

---

## Troubleshooting

**Error: "Server's protocol version is not supported: 2025-11-25"**
- Make sure you added `"MCP_VERSION": "2024-11-05"` to the env in your mcp.json
- Restart LM Studio after saving

**Tools don't appear?**
1. Restart LM Studio completely
2. Check LM Studio logs (Debug panel) for errors
3. Test manually:
   ```bash
   cd /path/to/firecrawl-mcp-effect
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | bun run stdio
   ```
   Should return JSON with `"protocolVersion": "2024-11-05"`

**"command not found: bun"?**
Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

**Still stuck?**
See detailed guide: `docs/lmstudio-integration.md`

---

## Available Tools (12 total)

- `firecrawl_scrape` - Scrape web pages
- `firecrawl_search` - Search the web
- `firecrawl_map` - Discover site URLs
- `firecrawl_crawl` - Crawl entire sites
- `firecrawl_extract` - Extract structured data
- `firecrawl_agent` - Autonomous research
- ...and 6 more!

Full list: Ask LM Studio to list available tools.
