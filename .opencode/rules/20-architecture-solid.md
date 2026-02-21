# SOLID Architecture Rules

## Single Responsibility

- Keep handler, config, services, and schema responsibilities separated.
- Avoid adding mixed concerns to `mcp-handler.ts` when a service abstraction is more appropriate.

## Open/Closed

- Extend behavior by adding new service implementations and wiring via layers.
- Add tools through definitions + schemas + registry without modifying unrelated code paths.

## Liskov + Interface Segregation

- Expose small interfaces (for example `RateLimiterOps`, `MetricsOps`) with focused contracts.
- Keep implementations substitutable without changing consumers.

## Dependency Inversion

- Depend on `Context.Tag` services in runtime code, not concrete classes.
- Wire concrete implementations in `src/lib/app-layer.ts`.
