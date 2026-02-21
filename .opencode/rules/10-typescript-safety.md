# TypeScript Safety Rules

## Required standards

- Maintain `strict` TypeScript compatibility.
- Avoid `any`; if unavoidable at SDK boundaries, isolate and document it.
- Prefer `readonly` shapes, discriminated unions, and explicit interfaces.
- Preserve runtime validation for external input using Effect Schema.

## Configuration and validation

- Route new env vars through `src/config/app-config.ts` with sane defaults.
- Normalize optional string env values (`""` => `undefined`) where appropriate.
- Keep JSON-RPC request/response and tool schemas aligned with runtime behavior.

## Error handling

- Use domain errors from `src/errors/mcp-errors.ts`.
- Map domain errors to stable wire errors; avoid throwing uncaught exceptions from handlers.
