# Claude Desktop Quick Start

## Add Firecrawl MCP to Claude Desktop in 3 Steps

### 1. Find Your Claude Config File

Claude Desktop config location varies by OS:

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### 2. Get Your Project Path

```bash
cd /Users/excalibur/Desktop/dev/firecrawl-mcp-effect
pwd
```

Copy the full path (e.g., `/Users/excalibur/Desktop/dev/firecrawl-mcp-effect`)

### 3. Edit Claude Config

Open (or create) `claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": [
        "run",
        "/Users/excalibur/Desktop/dev/firecrawl-mcp-effect/src/stdio-server.ts"
      ],
      "env": {
        "FIRECRAWL_API_KEY": "fc-bdadbb11005d41898abfc7fdf1d11522"
      }
    }
  }
}
```

**Important:** Replace the path in `args` with your actual path from step 2.

### 4. Restart Claude Desktop

Completely quit and restart Claude Desktop.

### 5. Test It

In Claude Desktop, ask:

> "Can you scrape https://example.com?"

You should see Claude using the MCP tools (look for a  icon or "Used firecrawl_scrape" message).

---

## Configuration Options

### Option 1: Environment Variable (Shown Above)

Pass API key via config:
```json
"env": {
  "FIRECRAWL_API_KEY": "your-key-here",
  "SAFE_MODE": "false"
}
```

### Option 2: Use .env File

If you prefer to keep your API key in `.env`:

**`.env` file:**
```env
FIRECRAWL_API_KEY=your-key-here
CLOUD_SERVICE=false
SAFE_MODE=false
```

**`claude_desktop_config.json`:**
```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": [
        "run",
        "/Users/excalibur/Desktop/dev/firecrawl-mcp-effect/src/stdio-server.ts"
      ]
    }
  }
}
```

The server will read from `.env` automatically.

---

## Protocol Version

Claude Desktop supports **MCP 2024-11-05** (the same as LM Studio).

Your server defaults to 2024-11-05, so no special configuration needed!

If you want to force a specific version:
```json
"env": {
  "FIRECRAWL_API_KEY": "your-key",
  "MCP_VERSION": "2024-11-05"
}
```

---

## Troubleshooting

### Zod validation errors ("invalid_union", "Expected string, received null")

✅ **Fixed!** This was caused by error responses using `id: null`. The server now uses `id: 0` for compatibility.

If you're still seeing this error, make sure you have the latest version and restart Claude Desktop.

### Tools don't appear in Claude?

1. **Run compatibility test:**
   ```bash
   cd /Users/excalibur/Desktop/dev/firecrawl-mcp-effect
   ./scripts/test-claude-compat.sh
   ```
2. **Check config file location** - Make sure you're editing the right file
3. **Verify JSON syntax** - No trailing commas, valid JSON
4. **Check Bun installation:**
   ```bash
   which bun
   bun --version
   ```
5. **Test stdio server manually:**
   ```bash
   cd /Users/excalibur/Desktop/dev/firecrawl-mcp-effect
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | bun run stdio
   ```
6. **Restart Claude completely** - Quit (Cmd+Q on Mac), then reopen

### "command not found: bun"

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

Then restart Claude Desktop.

### Check Claude Logs

**macOS:**
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Windows:**
```bash
type %APPDATA%\Claude\logs\mcp*.log
```

**Linux:**
```bash
tail -f ~/.config/Claude/logs/mcp*.log
```

### Server crashes immediately

1. **Check dependencies:**
   ```bash
   cd /Users/excalibur/Desktop/dev/firecrawl-mcp-effect
   bun install
   ```

2. **Verify API key is set** (in config or .env)

3. **Test typecheck:**
   ```bash
   bun run typecheck
   ```

---

## Available Tools

Once connected, Claude can use all 12 Firecrawl tools:

-  **firecrawl_scrape** - Scrape web pages
-  **firecrawl_search** - Search the web  
-  **firecrawl_map** - Discover site URLs
-  **firecrawl_crawl** - Crawl entire sites
-  **firecrawl_extract** - Extract structured data
-  **firecrawl_agent** - Autonomous research
-  **firecrawl_browser_create** - Create browser sessions
-  **firecrawl_browser_execute** - Execute browser code
-  **firecrawl_browser_delete** - Delete browser sessions
-  **firecrawl_browser_list** - List browser sessions
-  **firecrawl_check_crawl_status** - Check crawl status
-  **firecrawl_agent_status** - Check agent status

---

## Example Prompts

Try these in Claude Desktop:

```
"Can you scrape https://quotes.toscrape.com and show me some quotes?"

"Search the web for 'bun runtime' and summarize the top results"

"Map all the URLs on https://example.com"

"Scrape https://news.ycombinator.com and extract the top 5 stories with their titles and URLs"
```

---

## Security Notes

- Your Firecrawl API key is stored in the config file or .env
- The config file is **not** synced by Claude (it's local only)
- Consider using `.env` instead of embedding the key in `claude_desktop_config.json`
- Safe mode is disabled by default - set `"SAFE_MODE": "true"` to disable browser code execution

---

## Multiple MCP Servers

You can add multiple MCP servers to Claude. Example config with Firecrawl + others:

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": ["run", "/path/to/firecrawl-mcp-effect/src/stdio-server.ts"],
      "env": {
        "FIRECRAWL_API_KEY": "your-key"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/Documents"]
    }
  }
}
```

Each server runs independently, and Claude can use tools from all of them!

---

## Getting Help

- **Full documentation:** `docs/lmstudio-integration.md` (most applies to Claude too)
- **Test stdio manually:** `./scripts/test-stdio.sh`
- **Check server logs:** Look for stderr output in Claude's MCP logs

Enjoy using Firecrawl with Claude Desktop!
