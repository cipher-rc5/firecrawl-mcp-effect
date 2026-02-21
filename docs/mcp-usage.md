# MCP Usage Guide

This server implements JSON-RPC 2.0 for MCP over HTTP.

## Endpoint model

- Local: `POST http://localhost:<PORT>/mcp`
- Vercel: `POST https://<deployment>/mcp`

`GET /health` and `GET /metrics` are also available.

## Protocol flow

Typical session:

1. `initialize`
2. `tools/list`
3. `tools/call`

## Request format

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }
```

## Auth modes

### Mode A: single-tenant local/server

Set in env:

- `CLOUD_SERVICE=false`
- `FIRECRAWL_API_KEY=<key>` (or `FIRECRAWL_API_URL=<self-hosted-url>`)

No per-request API key header required.

### Mode B: cloud-service passthrough mode

Set in env:

- `CLOUD_SERVICE=true`

Send API key per request using one of:

1. `x-firecrawl-api-key: <key>`
2. `x-api-key: <key>`
3. `Authorization: Bearer <key>`

## Common calls

### initialize

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | jq
```

### tools/list

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq
```

### tools/call (scrape)

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "firecrawl_scrape",
      "arguments": {
        "url": "https://example.com",
        "formats": ["markdown"],
        "onlyMainContent": true
      }
    }
  }' | jq
```

## Error model

Errors are returned in JSON-RPC `error` objects.

Common codes:

- `-32001` unauthorized
- `-32002` configuration error
- `-32003` upstream Firecrawl error
- `-32004` tool not found
- `-32005` rate limited

## Runtime protections

Configured via environment:

- request body size limit (`MAX_REQUEST_BODY_BYTES`)
- request timeout (`REQUEST_TIMEOUT_MS`)
- fixed-window rate limit (`RATE_LIMIT_*`)

Each response includes `X-Request-Id` for correlation.
