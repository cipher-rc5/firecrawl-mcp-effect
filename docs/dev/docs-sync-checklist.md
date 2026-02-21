# Docs Sync Checklist

Use this checklist whenever behavior changes.

## Update triggers

- new env var
- changed request/response schema
- changed auth semantics
- changed rate limiting/timeout behavior
- changed CI/CD or deployment behavior

## Required updates

- `/docs/mcp-usage.md` for protocol/API behavior
- `/docs/troubleshooting.md` for new failure modes
- `/docs/architecture.md` Mermaid diagrams for dependency flow changes
- `/docs/dev/*` internal notes for implementation expectations
- root `README.md` for user-visible entrypoints or operations

## Verification

```bash
bun run typecheck
bun test
bun run smoke
```
