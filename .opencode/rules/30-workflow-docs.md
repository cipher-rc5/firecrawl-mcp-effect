# Workflow and Documentation Rules

## Engineering workflow

- After code changes, run `bun run typecheck` and `bun test`.
- For endpoint/runtime changes, run `bun run smoke` when feasible.
- Keep CI workflows aligned with local commands.

## Documentation workflow

- If behavior, env vars, APIs, or operational controls change, update:
  - `/docs` user/operator docs
  - `/docs/dev` developer/internal docs
- Keep examples copy-paste ready and consistent with real routes and headers.
- Keep Mermaid architecture diagrams updated when dependency flow changes.

## Quality bar

- Documentation should include: what changed, why it changed, and how to verify.
- Avoid stale docs by editing docs in the same PR as code changes.
