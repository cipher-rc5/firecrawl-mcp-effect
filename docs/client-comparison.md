# MCP Client Comparison

This Firecrawl MCP server supports multiple client applications. Here's how to use it with each:

## Supported Clients

| Client | Transport | Protocol Version | Setup Difficulty | Use Case |
|--------|-----------|------------------|------------------|----------|
| **Claude Desktop** | stdio | 2024-11-05 | ⭐ Easy | Personal AI assistant with web scraping |
| **LM Studio** | stdio | 2024-11-05 | ⭐ Easy | Local LLMs with web scraping tools |
| **Claude MCP Inspector** | HTTP JSON-RPC | 2025-11-25 | ⭐⭐ Medium | Testing and debugging MCP tools |
| **Custom Clients** | HTTP/SSE | Configurable | ⭐⭐⭐ Advanced | Programmatic integration |

---

## Quick Setup Links

### Claude Desktop
- **Quick Start:** [CLAUDE-DESKTOP-QUICKSTART.md](../CLAUDE-DESKTOP-QUICKSTART.md)
- **Setup Script:** `./scripts/setup-claude.sh`
- **Config File:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

### LM Studio  
- **Quick Start:** [LMSTUDIO-QUICKSTART.md](../LMSTUDIO-QUICKSTART.md)
- **Config File:** Edit via LM Studio UI (Program tab → Install → Edit mcp.json)

### HTTP Clients
- **Quick Start:** [quickstart.md](quickstart.md)
- **Usage:** [mcp-usage.md](mcp-usage.md)

---

## Transport Comparison

### stdio (Standard Input/Output)

**Used by:** Claude Desktop, LM Studio

**How it works:**
- Client spawns MCP server as subprocess
- Communication via stdin/stdout
- Logs go to stderr
- Newline-delimited JSON-RPC messages

**Pros:**
- ✅ No network configuration needed
- ✅ Automatic process management
- ✅ Secure (local only)
- ✅ Built-in log capture

**Cons:**
- ❌ One client per server instance
- ❌ Can't share across network
- ❌ Requires Bun installed locally

**Configuration example:**
```json
{
  "command": "bun",
  "args": ["run", "/path/to/src/stdio-server.ts"],
  "env": {
    "FIRECRAWL_API_KEY": "your-key"
  }
}
```

---

### HTTP JSON-RPC

**Used by:** Custom clients, testing tools

**How it works:**
- Server runs as HTTP service (`:3000` by default)
- POST requests to `/mcp` endpoint
- Standard `Content-Type: application/json`
- Synchronous request/response

**Pros:**
- ✅ Can serve multiple clients
- ✅ Network accessible
- ✅ Standard HTTP tools work (curl, Postman)
- ✅ Easy to debug

**Cons:**
- ❌ Requires separate server process
- ❌ Need network security (auth, CORS)
- ❌ Manual rate limiting

**Configuration example:**
```bash
# Start server
bun run dev

# Make request
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

### HTTP + SSE (Server-Sent Events)

**Used by:** Advanced clients that need streaming

**How it works:**
- POST with `Accept: text/event-stream` header
- Server responds with SSE stream
- Supports long-running operations
- Can send multiple responses per request

**Pros:**
- ✅ Supports streaming responses
- ✅ Network accessible
- ✅ Can handle server-initiated messages
- ✅ Reconnection support

**Cons:**
- ❌ More complex protocol
- ❌ Not all HTTP clients support SSE
- ❌ Requires session management for advanced features

**Configuration example:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

---

## Protocol Version Support

This server supports both MCP protocol versions with graceful degradation:

### 2024-11-05 (Stable)
- ✅ Supported by Claude Desktop
- ✅ Supported by LM Studio
- ✅ Full tool functionality
- ⚠️ Missing some metadata fields

**When to use:** Default for all desktop clients

### 2025-11-25 (Latest)
- ✅ Includes `isError` field in responses
- ✅ Includes `title` field in tool definitions
- ✅ Better error handling semantics
- ❌ Not yet supported by Claude Desktop or LM Studio

**When to use:** Custom clients, testing, future-proofing

**How to set:**
```bash
# Environment variable
MCP_VERSION=2024-11-05

# Or in mcp.json
"env": {
  "MCP_VERSION": "2024-11-05"
}
```

---

## Feature Matrix

| Feature | Claude Desktop | LM Studio | HTTP Clients |
|---------|---------------|-----------|--------------|
| Web scraping | ✅ | ✅ | ✅ |
| Web search | ✅ | ✅ | ✅ |
| Site mapping | ✅ | ✅ | ✅ |
| Async crawling | ✅ | ✅ | ✅ |
| Data extraction | ✅ | ✅ | ✅ |
| Research agent | ✅ | ✅ | ✅ |
| Browser automation | ✅* | ✅* | ✅* |
| Rate limiting | N/A | N/A | ✅ |
| Multi-client | ❌ | ❌ | ✅ |
| Remote access | ❌ | ❌ | ✅ |

*Browser automation can be disabled via `SAFE_MODE=true`

---

## Choosing the Right Client

### Use Claude Desktop if:
- ✅ You want the best AI chat experience
- ✅ You're already using Claude
- ✅ You want automatic tool selection
- ✅ You need conversation context

### Use LM Studio if:
- ✅ You want to run local LLMs
- ✅ You need offline capabilities
- ✅ You want privacy (everything local)
- ✅ You're experimenting with different models

### Use HTTP mode if:
- ✅ Building custom integrations
- ✅ Need to serve multiple clients
- ✅ Want programmatic API access
- ✅ Deploying to production (Vercel, etc.)

---

## Next Steps

1. **Pick a client** from the table above
2. **Follow the quick start guide** for that client
3. **Test with a simple prompt** like "Scrape https://example.com"
4. **Explore the 12 available tools** (ask "What tools do you have?")

Happy scraping! 🕷️
