# Troubleshooting

This guide covers common runtime failures and exact fixes.

## Fast triage checklist

1. Confirm server is reachable:
   - `curl -s http://localhost:3000/health | jq`
2. Confirm MCP shape:
   - valid JSON-RPC 2.0 envelope (`jsonrpc`, `id`, `method`)
3. Confirm auth mode:
   - `CLOUD_SERVICE=true` requires request header key
4. Confirm env values are not empty placeholders:
   - avoid `FIRECRAWL_API_URL=` with blank value
5. Inspect logs and correlate by `X-Request-Id`

## Error: "Firecrawl API key is required" (`-32001`)

Cause:

- `CLOUD_SERVICE=true` but request missing API key header.

Fix:

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-firecrawl-api-key: $FIRECRAWL_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq
```

If you want env-based single key behavior instead, set `CLOUD_SERVICE=false`.

## Error: "Firecrawl scrape failed" (`-32003`)

Cause:

- upstream Firecrawl call failed (auth, network, quota, URL, or config).

Fix:

1. Verify API key validity and plan limits.
2. Verify URL target is reachable.
3. Check logs for sanitized upstream status and message.
4. Retry with a minimal payload first.

Minimal payload:

```json
{ "url": "https://example.com", "formats": ["markdown"] }
```

## Error: request body too large (HTTP 413)

Cause:

- payload exceeds `MAX_REQUEST_BODY_BYTES`.

Fix:

- reduce argument size
- raise `MAX_REQUEST_BODY_BYTES` if safe for your environment

## Error: request timed out (HTTP 504)

Cause:

- total request time exceeded `REQUEST_TIMEOUT_MS`.

Fix:

- increase `REQUEST_TIMEOUT_MS`
- reduce scope (fewer formats, less aggressive crawl options)
- move long-running work to async tools where applicable

## Error: rate limit exceeded (`-32005`, HTTP 429)

Cause:

- requests exceeded `RATE_LIMIT_REQUESTS` within `RATE_LIMIT_WINDOW_MS`.

Fix:

- honor `Retry-After`
- increase limits if expected traffic is legitimate
- use external/distributed limiter for multi-instance deployments

## Port in use when starting local dev server

Cause:

- another process is bound to your `PORT`.

Fix:

- set a different `PORT` in `.env`
- or stop the existing process on that port

## Verify all local checks

```bash
bun run typecheck
bun test
bun run smoke
```
