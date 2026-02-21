# Developer Docs

Internal documentation for contributors and LLM agents.

## Contents

- [Engineering Standards](./engineering-standards.md)
- [Architecture Notes](./architecture-notes.md)
- [Docs Sync Checklist](./docs-sync-checklist.md)

## Development verification

Run before opening a PR:

```bash
bun run typecheck
bun test
bun run smoke
```
