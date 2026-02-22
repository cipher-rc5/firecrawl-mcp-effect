# LM Studio Integration Guide

This guide shows you how to connect your Firecrawl MCP server to LM Studio.

## Prerequisites

- **LM Studio** version 0.3.17 or later
- **Bun** >= 1.1.0 (to run the MCP server)
- **Firecrawl API key** (get one at https://firecrawl.dev)

---

## Quick Start

### Step 1: Install and Configure

```bash
# In your firecrawl-mcp-effect directory
bun install
cp .env.example .env
```

Edit `.env` and configure:

```env
FIRECRAWL_API_KEY=your-actual-key-here
CLOUD_SERVICE=false
SAFE_MODE=true
RATE_LIMIT_ENABLED=false
LOG_LEVEL=info
```

### Step 2: Configure LM Studio

1. **Open LM Studio** (version 0.3.17+)
2. Navigate to the **"Program" tab** in the right sidebar
3. Click **"Install" > "Edit mcp.json"**
4. Add this configuration:

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": ["run", "/FULL/PATH/TO/firecrawl-mcp-effect/src/stdio-server.ts"],
      "env": { "FIRECRAWL_API_KEY": "your-firecrawl-api-key-here", "SAFE_MODE": "true", "MCP_VERSION": "2024-11-05" }
    }
  }
}
```

**Important Notes:**

- Replace `/FULL/PATH/TO/firecrawl-mcp-effect` with the absolute path to your project directory
- **Must include `MCP_VERSION: "2024-11-05"`** — LM Studio doesn't support 2025-11-25 yet

To find the full path, run this in your project directory:

```bash
pwd
```

Example result: `/Users/yourname/projects/firecrawl-mcp-effect`

5. **Save the file** — LM Studio will automatically start the MCP server when needed

### Step 3: Verify Connection

In LM Studio's chat interface:

- The Firecrawl tools should now appear in the available tools list (you may need to restart LM Studio)
- Try asking: **"Can you scrape the content from https://example.com?"**
- The AI should automatically use the `firecrawl_scrape` tool

**Troubleshooting:** If tools don't appear, check LM Studio logs for connection errors. The server logs to stderr, which LM Studio captures.

---

## Available Tools

Your Firecrawl MCP server provides 12 tools to LM Studio:

| Tool                           | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `firecrawl_scrape`             | Scrape content from a single URL                |
| `firecrawl_map`                | Discover all URLs on a site                     |
| `firecrawl_search`             | Search the web and scrape results               |
| `firecrawl_crawl`              | Start async crawl job across multiple pages     |
| `firecrawl_check_crawl_status` | Check crawl job status                          |
| `firecrawl_extract`            | Extract structured data from URLs               |
| `firecrawl_agent`              | Autonomous web research agent                   |
| `firecrawl_agent_status`       | Check agent job status                          |
| `firecrawl_browser_create`     | Create browser automation session               |
| `firecrawl_browser_execute`    | Execute code in browser (disabled in safe mode) |
| `firecrawl_browser_delete`     | Delete browser session                          |
| `firecrawl_browser_list`       | List active browser sessions                    |

---

## Configuration Options

### Option 1: Environment Variable (Recommended)

Pass the API key via `mcp.json` env field:

**LM Studio `mcp.json`:**

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": ["run", "/path/to/firecrawl-mcp-effect/src/stdio-server.ts"],
      "env": { "FIRECRAWL_API_KEY": "your-key-here", "SAFE_MODE": "true" }
    }
  }
}
```

### Option 2: .env File

Store the API key in `.env` (more secure, not in config file):

**`.env`:**

```env
FIRECRAWL_API_KEY=your-key-here
CLOUD_SERVICE=false
SAFE_MODE=true
```

**LM Studio `mcp.json`:**

```json
{
  "mcpServers": {
    "firecrawl": { "command": "bun", "args": ["run", "/path/to/firecrawl-mcp-effect/src/stdio-server.ts"] }
  }
}
```

The server will read from `.env` automatically.

---

## Technical Details

### stdio Transport

LM Studio uses **stdio (standard input/output)** for MCP communication. It spawns the MCP server as a subprocess and communicates via:

- **stdin**: LM Studio sends newline-delimited JSON-RPC requests
- **stdout**: Server sends newline-delimited JSON-RPC responses
- **stderr**: Server logs (captured by LM Studio for debugging)

The server supports multiple transports:

- **stdio transport** (for LM Studio, Claude Desktop)
- **HTTP with SSE** (for remote clients)
- **Standard HTTP JSON-RPC** (for Claude MCP Inspector)

### Protocol Version

This server supports **both MCP 2024-11-05 and MCP 2025-11-25**.

**For LM Studio:** Use `2024-11-05` (LM Studio doesn't support 2025-11-25 yet)

Set in your `mcp.json`:

```json
"env": {
  "MCP_VERSION": "2024-11-05"
}
```

**For newer clients:** The server defaults to `2025-11-25` and includes latest features like:

- `isError` field in tool results
- `title` field in tool definitions
- Better error handling semantics

### Response Format

All tool results include:

- `content`: Array of result items
- `isError`: Boolean indicating success/failure

This allows LLMs to self-correct on execution errors.

---

## Troubleshooting

### Error: "command not found: bun"

**Problem:** Bun not installed or not in PATH

**Solution:**

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

Alternatively, use `bunx` instead of `bun run` in your `mcp.json`:

```json
{ "command": "bunx", "args": ["--bun", "/path/to/src/stdio-server.ts"] }
```

---

### Error: "Cannot find module"

**Problem:** Dependencies not installed

**Solution:**

```bash
cd /path/to/firecrawl-mcp-effect
bun install
```

---

### Error: "Server's protocol version is not supported: 2025-11-25"

**Problem:** LM Studio doesn't support MCP 2025-11-25 yet

**Solution:** Add `MCP_VERSION` to your env in `mcp.json`:

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": ["run", "/path/to/src/stdio-server.ts"],
      "env": { "FIRECRAWL_API_KEY": "your-key", "MCP_VERSION": "2024-11-05" }
    }
  }
}
```

Restart LM Studio after saving.

---

### Error: stdio server crashes immediately

**Problem:** Check LM Studio logs for the actual error

**Solution:**

1. Test the stdio server manually:

```bash
cd /path/to/firecrawl-mcp-effect
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | bun run stdio
```

2. You should see a JSON-RPC response. If not, check:
   - `.env` file exists and has `FIRECRAWL_API_KEY`
   - All dependencies installed (`bun install`)
   - No syntax errors (`bun run typecheck`)

---

### Error: "Firecrawl API key is required"

**Problem:** API key not configured

**Solution:**

- If `CLOUD_SERVICE=false`: Add `FIRECRAWL_API_KEY` to `.env`
- If `CLOUD_SERVICE=true`: Add header to LM Studio `mcp.json`

---

### Tools not appearing in LM Studio

**Problem:** LM Studio not recognizing the MCP server

**Solution:**

1. Verify `mcp.json` syntax is correct (no trailing commas)
2. Restart LM Studio completely
3. Check LM Studio logs for connection errors
4. Verify you have LM Studio 0.3.17 or later

---

### Server responds but tools fail

**Problem:** Tools execute but return errors

**Solution:**

1. Check server logs: `bun run dev` shows detailed logging
2. Verify Firecrawl API key is valid
3. Check API quota/limits on your Firecrawl account
4. Look for `X-Request-Id` in responses for correlation

Example log:

```json
{
  "ts": "2026-02-22T04:30:00.000Z",
  "level": "error",
  "message": "tool:call:failed",
  "phase": "tool_execute",
  "tool": "firecrawl_scrape",
  "mcp_code": -32010,
  "upstream_status": 401
}
```

---

## Testing Your Setup

### Manual stdio Test

Test the stdio server directly:

```bash
cd /path/to/firecrawl-mcp-effect

# Test initialize
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | bun run stdio
```

Expected output (on stdout):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": { "tools": { "listChanged": false } },
    "serverInfo": { "name": "firecrawl-mcp", "version": "1.0.0" }
  }
}
```

You'll also see debug logs on stderr like:

```
[firecrawl-mcp-stdio] Starting stdio transport server
[firecrawl-mcp-stdio] Protocol: MCP 2025-11-25
```

### Test tools/list

```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | bun run stdio
```

You should see a JSON response with all 12 Firecrawl tools.

### Example LM Studio Conversation

```
User: Can you scrape https://example.com and tell me what you find?
```
