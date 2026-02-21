# Engineering Standards

## Language and runtime

- TypeScript only for source code.
- Bun is the runtime and package manager.
- Keep dependencies pinned to exact versions.

## Type safety

- Keep strict compiler guarantees intact.
- Prefer explicit interfaces and narrow union types.
- Validate external input with Effect Schema.

## Error model

- Use domain errors from `src/errors/mcp-errors.ts`.
- Convert all domain errors to stable JSON-RPC wire errors.

## SOLID requirements

- New cross-cutting behavior should be introduced as services (`Context.Tag`) and layered in `AppLive`.
- Do not hard-code globals in handlers when abstractions exist.

## Reliability and security

- Preserve request body limits, timeout budgets, and rate limits.
- Avoid logging secrets; sanitize upstream diagnostics.
