# Quickstart

This guide gets a local MCP server running and validates a full request flow

## 1) Install dependencies

```bash
bun install
```

## 2) Configure environment

```bash
cp .env.example .env
```

Set one of:

- `FIRECRAWL_API_KEY` for Firecrawl cloud
- `FIRECRAWL_API_URL` for a self-hosted Firecrawl instance

Recommended local defaults:

```env
CLOUD_SERVICE=false
PORT=3000
LOG_LEVEL=info
```

## 3) Start server

```bash
bun run dev
```

## 4) Health check

```bash
curl -s http://localhost:3000/health | jq
```

Expected:

```json
{ "status": "ok" }
```

## 5) MCP initialize

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | jq
```

## 6) Call a tool

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "firecrawl_scrape",
      "arguments": {
        "url": "https://quotes.toscrape.com/",
        "formats": ["markdown"],
        "onlyMainContent": true
      }
    }
  }' | jq
```

## 7) Optional: metrics endpoint

```bash
curl -s http://localhost:3000/metrics
```
