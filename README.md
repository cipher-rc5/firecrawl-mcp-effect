# firecrawl-mcp

A self-hostable, Vercel-compatible MCP (Model Context Protocol) server for
[Firecrawl](https://firecrawl.dev), built with strict TypeScript ES2024,
[Effect-TS](https://effect.website), and the Bun runtime.

**Quick Start:**
-  [**Add to Claude Desktop**](CLAUDE-DESKTOP-QUICKSTART.md) (or run `./scripts/setup-claude.sh`)
-  [**Add to LM Studio**](LMSTUDIO-QUICKSTART.md)
-  [Full Documentation](docs/README.md) (including developer docs in `docs/dev/`)

---

## Architecture

```
firecrawl-mcp/
├── api/                        # Vercel serverless function entrypoints
│   ├── health.ts               # GET /health — LB probe
│   └── mcp.ts                  # POST / — MCP JSON-RPC 2.0 handler
├── src/
│   ├── config/
│   │   └── app-config.ts       # Effect Config — typed secret management
│   ├── errors/
│   │   └── mcp-errors.ts       # Tagged domain errors (Data.TaggedError)
│   ├── services/
│   │   ├── firecrawl-client.ts # Effect Layer wrapping @mendable/firecrawl-js
│   │   └── logger.ts           # Structured JSON logger service
│   ├── api/
│   │   ├── groups/
│   │   │   └── mcp-handler.ts  # MCP JSON-RPC dispatch + web adapter
│   │   └── schemas/
│   │       └── firecrawl-schemas.ts  # Effect Schema types for all tools
│   ├── tools/
│   │   ├── tool-definitions.ts # Static tool metadata (tools/list)
│   │   ├── tool-registry.ts    # Handler map — name -> Effect handler
│   │   └── tool-schemas.ts     # Schema re-exports (avoids circular imports)
│   ├── lib/
│   │   ├── app-layer.ts        # Full Layer DAG composition
│   │   └── utils.ts            # Pure utilities (sanitization, parsing)
│   └── server.ts               # Local Bun dev server
├── .env.example
├── dprint.json
├── package.json
├── tsconfig.json
└── vercel.json
```

### SOLID alignment

| Principle                 | Implementation                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **Single Responsibility** | Each file owns one concern: config, errors, client, handler, schemas                         |
| **Open/Closed**           | New tools added via `TOOL_DEFINITIONS` + `REGISTRY` without touching existing handlers       |
| **Liskov Substitution**   | `FirecrawlClientOps` interface — cloud and self-hosted clients are interchangeable           |
| **Interface Segregation** | `FirecrawlClientOps` exposes only what handlers need, not the full SDK surface               |
| **Dependency Inversion**  | All services resolved via Effect `Layer` / `Context.Tag` — no direct `new` calls in handlers |

---

## Requirements

- **Bun** >= 1.1.0
- **Firecrawl API key** or a self-hosted Firecrawl instance URL

---

## Runtime model

| Context          | Runtime                                               |
| ---------------- | ----------------------------------------------------- |
| Local dev server | Bun (native, `bun run dev`)                           |
| Type-checking    | Bun invoking `tsc` (`bun tsc --noEmit`)               |
| Formatting       | dprint (`bun run fmt`)                                |
| Bundler          | Bun (`bun build --target node --format esm`)          |
| Vercel execution | Node.js 22 running the compiled ESM output in `dist/` |

Bun is the exclusive toolchain — installer, bundler, test runner, dev server, and
type-checker host. Vercel runs the _compiled output_ under Node.js 22. There is no
runtime conflict: the source is never handed to Node raw. The `functions` block in
`vercel.json` is intentionally absent; Vercel auto-detects `api/` handlers and
serves the bundled `dist/` output.

---

## Local development

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env.local
# Edit .env.local: set FIRECRAWL_API_KEY or FIRECRAWL_API_URL

# Start dev server with hot reload
bun run dev
# Server listens on http://localhost:3000

# Type-check (bun hosts tsc — no separate tsc binary needed)
bun run typecheck

# Format all source files
bun run fmt

# Check formatting without writing (CI)
bun run fmt:check
```

### Sending a test request

```bash
# List available tools
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Scrape a page
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "firecrawl_scrape",
      "arguments": {
        "url": "https://example.com",
        "formats": ["markdown"],
        "onlyMainContent": true
      }
    }
  }'

# Export Prometheus metrics
curl -X GET http://localhost:3000/metrics
```

---

## Vercel deployment

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI
vercel env add FIRECRAWL_API_KEY
```

### Environment variables

| Variable                 | Required         | Description                                                                                                                   |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `FIRECRAWL_API_KEY`      | One of these two | Firecrawl cloud API key                                                                                                       |
| `FIRECRAWL_API_URL`      | One of these two | Self-hosted instance base URL                                                                                                 |
| `CLOUD_SERVICE`          | No               | `true` to require per-request API key via header                                                                              |
| `SAFE_MODE`              | No               | `true` to disable browser execute and crawl webhooks                                                                          |
| `MAX_REQUEST_BODY_BYTES` | No               | Max request body size in bytes (default: `1048576`)                                                                           |
| `REQUEST_TIMEOUT_MS`     | No               | Request timeout budget in ms (default: `25000`)                                                                               |
| `RATE_LIMIT_ENABLED`     | No               | Enable in-memory per-IP rate limiting (default: `true`)                                                                       |
| `RATE_LIMIT_REQUESTS`    | No               | Allowed requests per window (default: `120`)                                                                                  |
| `RATE_LIMIT_WINDOW_MS`   | No               | Rate-limit window in ms (default: `60000`)                                                                                    |
| `PORT`                   | No               | Local server port (default: 3000)                                                                                             |
| `LOG_LEVEL`              | No               | `debug` \| `info` \| `warn` \| `error` (default: `info`)                                                                      |
| `MCP_VERSION`            | No               | MCP protocol version (default: `2025-11-25`)                                                                                  |
| `ALLOWED_ORIGINS`        | No               | Comma-separated allowlist of permitted `Origin` values for CSRF protection. Omit or set to `*` to disable (default: disabled) |

---

## Cloud service mode

When `CLOUD_SERVICE=true`, the API key is read from each incoming request rather
than from the environment:

```http
POST / HTTP/1.1
x-firecrawl-api-key: fc-your-key-here
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

Accepted headers (in priority order):

1. `x-firecrawl-api-key`
2. `x-api-key`
3. `Authorization: Bearer <key>`

---

## Safe mode

When `SAFE_MODE=true` (automatically enabled when `CLOUD_SERVICE=true`):

- `firecrawl_scrape` strips `actions` that involve user interaction (click, write, executeJavascript, generatePDF)
- `firecrawl_crawl` strips the `webhook` option
- `firecrawl_browser_execute` returns an error

---

## Observability

- Every response includes `X-Request-Id` for end-to-end correlation.
- Structured logs capture tool failures with sanitized upstream diagnostics.
- `GET /metrics` exposes Prometheus text metrics:
  - `mcp_requests_total`
  - `mcp_request_duration_ms_total`
  - `mcp_tool_calls_total`
  - `mcp_tool_duration_ms_total`

---

## CI/CD

- CI workflow (`.github/workflows/ci.yml`) runs on PRs and `main` pushes:
  - formatting check
  - typecheck
  - tests
  - smoke checks
- Dependency policy workflow (`.github/workflows/dependency-policy.yml`) enforces exact pinned versions and rejects committed `bun.lock`.
- Security workflow (`.github/workflows/security.yml`) runs `bun audit` and CodeQL analysis.
- Dependabot config (`.github/dependabot.yml`) manages Bun and GitHub Actions updates weekly.
- CD workflow (`.github/workflows/deploy.yml`) deploys to Vercel after CI succeeds on `main`.

Required repository secrets for deployment:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

## Adding a new tool

1. Add a `ToolDefinition` entry to `src/tools/tool-definitions.ts`
2. Add a Schema to `src/api/schemas/firecrawl-schemas.ts`
3. Re-export the Schema in `src/tools/tool-schemas.ts`
4. Add a handler function and register it in `src/tools/tool-registry.ts`

No other files need modification.

---

## Effect Layer DAG

```
AppConfigLive (Config env)
    |
    +-- AppLoggerLive
    |
    +-- FirecrawlClientLive
         |
         +-- AppLive (merged)
              |
              +-- ManagedRuntime (api/mcp.ts)
```
