# Architecture Notes

## Current service set

- `AppConfig`: typed env/config loading
- `AppLogger`: structured logging
- `AppMetrics`: in-memory counters + Prometheus export
- `RateLimiter`: request throttling abstraction
- `FirecrawlClient`: SDK adapter and error wrapping

## Request path summary

1. HTTP request enters `handle_web_request`
2. apply rate limit and request size checks
3. parse + schema decode MCP request
4. dispatch method (`initialize`, `tools/list`, `tools/call`)
5. execute tool through registry + service client
6. map domain errors to wire errors
7. emit logs/metrics and return response with `X-Request-Id`

## Extension strategy

- Add new shared concerns as services and layer them in `src/lib/app-layer.ts`.
- Keep tool additions isolated to:
  - `src/tools/tool-definitions.ts`
  - `src/api/schemas/firecrawl-schemas.ts`
  - `src/tools/tool-registry.ts`
