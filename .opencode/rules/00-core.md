# Core Rules

## Mission

Ship production-grade, type-safe TypeScript changes with clear operational documentation.

## Global constraints

- Use Bun commands for scripts and package operations.
- Keep edits minimal, intentional, and backward compatible unless task requires otherwise.
- Do not remove or weaken validation, auth, rate limiting, or timeout protections.
- Never leak secrets in logs, tests, or docs.

## Decision defaults

- Prefer the existing architecture and naming conventions.
- Prefer adding behavior through interfaces/services over ad-hoc module state.
- Prefer explicit typed errors over generic exceptions.
