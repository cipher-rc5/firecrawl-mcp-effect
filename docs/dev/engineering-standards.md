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

## TypeScript version policy

The project pins TypeScript to the latest stable patch release of the current
stable minor. Verify the target version is tagged as `latest` on npm (not `next`,
`rc`, or `beta`) before upgrading.

Current pin: `5.9.3` — confirmed as `dist-tags.latest` on npmjs.com.

When upgrading TypeScript:

1. Confirm the candidate is `dist-tags.latest` (not `next` or `rc`):
   `bun -e "const r = await fetch('https://registry.npmjs.org/typescript'); const j = await r.json(); console.log(j['dist-tags'])"`
2. Update `package.json` devDependencies.
3. Run `bun run typecheck` and resolve all new errors before merging.
4. Review the TypeScript release notes for breaking changes in declaration emit
   that may affect ambient module augmentations in `src/types/`.

## SDK type augmentations

The file `src/types/firecrawl-extensions.d.ts` is a version-checkpoint marker for
`@mendable/firecrawl-js`. It currently contains no active augmentations because
`AgentResponse` and `AgentStatusResponse` are properly declared in the SDK at version
`4.13.0`. The file exists as a mandatory review point during upgrades.

When upgrading `@mendable/firecrawl-js`:

1. Re-check SDK declarations:
   `grep -n "startAgent\|getAgentStatus" node_modules/@mendable/firecrawl-js/dist/index.d.ts`
2. If signatures changed, update `src/services/firecrawl-client.ts` and the checkpoint comment.
3. Run `bun run typecheck` to verify no regressions.
4. Run `grep -rn "as any\|@ts-ignore\|@ts-expect-error" src/` — must return zero results.
