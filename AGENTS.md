# firecrawl-mcp Agent Rules

This project uses strict TypeScript and Effect-TS. Treat these rules as required.

## Immediate loading

Load and follow these files at the start of each task:

- `@.opencode/rules/00-core.md`
- `@.opencode/rules/10-typescript-safety.md`
- `@.opencode/rules/20-architecture-solid.md`
- `@.opencode/rules/30-workflow-docs.md`

## Task-driven loading

For implementation and operations tasks, load relevant docs on demand:

- `@docs/quickstart.md`
- `@docs/mcp-usage.md`
- `@docs/troubleshooting.md`
- `@docs/architecture.md`
- `@docs/dev/README.md`

## Behavior requirements

- Prefer edits that preserve strict type-safety.
- Keep dependencies pinned and avoid introducing version ranges.
- Preserve SOLID design boundaries (services and interfaces over hard-coded globals).
- Keep `/docs` and `/docs/dev` synchronized with behavior/API changes.
