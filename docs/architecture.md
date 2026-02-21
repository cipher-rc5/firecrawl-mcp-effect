# Architecture and Dependencies

This document maps request flow, service composition, and key dependencies.

## Request lifecycle

```mermaid
flowchart TD
    A[HTTP Request] --> B[handle_web_request]
    B --> C[Rate limit check]
    C --> D[Body size check]
    D --> E[JSON parse + schema validate]
    E --> F[handle_mcp_request]
    F --> G{Method}
    G -->|initialize| H[Return capabilities]
    G -->|tools/list| I[Return tool definitions]
    G -->|tools/call| J[Resolve auth + client]
    J --> K[Resolve tool handler]
    K --> L[Execute Firecrawl operation]
    L --> M[Map domain result/error]
    M --> N[Record metrics + logs]
    N --> O[JSON-RPC Response + X-Request-Id]
```

## Layered dependency graph

```mermaid
graph TD
    AC[AppConfigLive]
    AL[AppLoggerLive]
    AM[AppMetricsLive]
    FC[FirecrawlClientLive]
    RL[RateLimiterLive]
    APP[AppLive]
    H[API Handlers]

    AC --> AL
    AC --> FC
    AC --> RL
    AC --> APP
    AL --> APP
    AM --> APP
    FC --> APP
    RL --> APP
    APP --> H
```

## Runtime component map

```mermaid
graph LR
    Client[MCP Client] --> Edge[HTTP Endpoint /mcp]
    Edge --> Handler[mcp-handler.ts]
    Handler --> Registry[tool-registry.ts]
    Registry --> Schemas[firecrawl-schemas.ts]
    Handler --> FCClient[firecrawl-client.ts]
    FCClient --> FirecrawlAPI[(Firecrawl API)]
    Handler --> Logger[logger.ts]
    Handler --> Metrics[metrics.ts]
    Handler --> Limiter[rate-limiter.ts]
```

## Key files

- `src/api/groups/mcp-handler.ts`: request parsing, auth extraction, dispatch, response shaping
- `src/tools/tool-registry.ts`: tool routing + schema decode + operation execution
- `src/services/firecrawl-client.ts`: Firecrawl SDK adapter and error wrapping
- `src/config/app-config.ts`: typed env loading and defaults
- `src/services/metrics.ts`: in-memory metric aggregation and Prometheus export
- `src/services/rate-limiter.ts`: dependency-inverted request rate limiting

## Security and reliability controls

- input schema validation for MCP envelopes and tool params
- bounded request size and timeout budget
- request-level rate limiting with retry headers
- structured logging and request correlation via `X-Request-Id`
- Prometheus-compatible metrics endpoint
