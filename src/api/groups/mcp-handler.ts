// file: src/api/groups/mcp-handler.ts
// description: Core MCP JSON-RPC 2.0 protocol handler — routes methods to tools, formats responses
// reference: https://spec.modelcontextprotocol.io/specification/

import { Effect } from 'effect';
import { Schema } from 'effect';
import { AppConfig } from '../../config/app-config.ts';
import { FirecrawlClientError, type McpDomainError, McpErrorCode } from '../../errors/mcp-errors.ts';
import { extract_api_key, extract_client_ip, validate_origin } from '../../lib/utils.ts';
import { get_client } from '../../services/firecrawl-client.ts';
import { FirecrawlClient } from '../../services/firecrawl-client.ts';
import { AppLogger } from '../../services/logger.ts';
import type { LoggerOps } from '../../services/logger.ts';
import { AppMetrics } from '../../services/metrics.ts';
import { RateLimiter } from '../../services/rate-limiter.ts';
import { TOOL_DEFINITIONS } from '../../tools/tool-definitions.ts';
import { get_tool_handler } from '../../tools/tool-registry.ts';
import type { McpRequest, McpResponse } from '../schemas/firecrawl-schemas.ts';
import { McpRequest as McpRequestSchema } from '../schemas/firecrawl-schemas.ts';

// ---------------------------------------------------------------------------
// Server capabilities advertised in initialize response
// ---------------------------------------------------------------------------

const SERVER_CAPABILITIES = { tools: { listChanged: false } } as const;

const SERVER_INFO = { name: 'firecrawl-mcp', version: '1.0.0' } as const;

// ---------------------------------------------------------------------------
// Error → wire format
// ---------------------------------------------------------------------------

function domain_error_to_wire(id: string | number | null, err: McpDomainError): McpResponse {
  const code = 'code' in err ? (err.code as number) : McpErrorCode.internal_error;
  const err_message = 'message' in err && typeof err.message === 'string' ? err.message.trim() : '';
  const message = err_message.length > 0 ?
    err_message :
    'tool_name' in err && typeof err.tool_name === 'string' ?
    `Tool not found: ${err.tool_name}` :
    '_tag' in err && typeof err._tag === 'string' ?
    err._tag :
    'Unknown error';

  return { jsonrpc: '2.0', id, error: { code, message } };
}

function ok_response(id: string | number | null, result: unknown): McpResponse {
  return { jsonrpc: '2.0', id, result };
}

function truncate(value: string, max_len: number = 300): string {
  return value.length <= max_len ? value : `${value.slice(0, max_len)}...`;
}

function safe_firecrawl_cause(cause: unknown): Record<string, unknown> {
  if (typeof cause !== 'object' || cause === null) return {};

  const obj = cause as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (typeof obj['name'] === 'string') out['upstream_name'] = obj['name'];
  if (typeof obj['code'] === 'string' || typeof obj['code'] === 'number') out['upstream_code'] = obj['code'];
  if (typeof obj['message'] === 'string') out['upstream_message'] = truncate(obj['message']);
  if (typeof obj['status'] === 'number') out['upstream_status'] = obj['status'];

  const response = obj['response'];
  if (typeof response === 'object' && response !== null) {
    const response_obj = response as Record<string, unknown>;
    if (typeof response_obj['status'] === 'number') out['upstream_status'] = response_obj['status'];

    const data = response_obj['data'];
    if (typeof data === 'object' && data !== null) {
      const data_obj = data as Record<string, unknown>;
      if (typeof data_obj['error'] === 'string') out['upstream_error'] = truncate(data_obj['error']);
      if (typeof data_obj['message'] === 'string') out['upstream_error_message'] = truncate(data_obj['message']);
    }
  }

  return out;
}

function log_domain_error(logger: LoggerOps, err: McpDomainError, context: Record<string, unknown>): void {
  if (err instanceof FirecrawlClientError) {
    logger.error('tool:call:failed', {
      ...context,
      mcp_code: err.code,
      mcp_message: err.message,
      ...safe_firecrawl_cause(err.cause)
    });
    return;
  }

  logger.warn('tool:call:failed', {
    ...context,
    mcp_code: 'code' in err ? err.code : McpErrorCode.internal_error,
    mcp_message: 'message' in err && typeof err.message === 'string' ? err.message : 'Unhandled error'
  });
}

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

function handle_initialize(req: McpRequest): Effect.Effect<McpResponse, never, AppConfig> {
  return Effect.gen(function*() {
    const config = yield* AppConfig;
    return ok_response(req.id, {
      protocolVersion: config.mcp_version,
      capabilities: SERVER_CAPABILITIES,
      serverInfo: SERVER_INFO
    });
  });
}

function handle_tools_list(req: McpRequest): McpResponse {
  return ok_response(req.id, { tools: TOOL_DEFINITIONS });
}

function handle_tools_call(
  req: McpRequest,
  header_api_key: string | undefined
): Effect.Effect<McpResponse, never, AppConfig | AppLogger | FirecrawlClient | AppMetrics> {
  return Effect.gen(function*() {
    const config = yield* AppConfig;
    const logger = yield* AppLogger;
    const metrics = yield* AppMetrics;

    const raw_params = req.params as Record<string, unknown> | undefined;
    const tool_name = raw_params?.['name'];
    const tool_args = raw_params?.['arguments'] ?? {};

    if (typeof tool_name !== 'string') {
      return {
        jsonrpc: '2.0' as const,
        id: req.id,
        error: { code: McpErrorCode.invalid_params, message: 'params.name must be a string' }
      };
    }

    const client_effect = get_client(header_api_key, config.cloud_service, config.firecrawl_api_url);

    const client = yield* client_effect.pipe(Effect.catchAll((err) => {
      log_domain_error(logger, err, { phase: 'client_resolve', tool: tool_name });
      return Effect.fail(domain_error_to_wire(req.id, err));
    }));

    const handler = yield* get_tool_handler(tool_name).pipe(Effect.catchAll((err) => {
      log_domain_error(logger, err, { phase: 'handler_lookup', tool: tool_name });
      return Effect.fail(domain_error_to_wire(req.id, err));
    }));

    const started_at = Date.now();

    const result = yield* handler(tool_args, client, config.safe_mode).pipe(Effect.catchAll((err) => {
      metrics.record_tool_call(tool_name, 'failure', Date.now() - started_at);
      log_domain_error(logger, err, { phase: 'tool_execute', tool: tool_name });
      return Effect.fail(domain_error_to_wire(req.id, err));
    }));

    metrics.record_tool_call(tool_name, 'success', Date.now() - started_at);

    logger.debug('tool:call:success', { tool: tool_name });

    return ok_response(req.id, { content: [{ type: 'text', text: result }] });
  }).pipe(Effect.catchAll((wire) => Effect.succeed(wire as McpResponse)));
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

/**
 * Routes an MCP request to the proper method handler.
 */
export function handle_mcp_request(
  req: McpRequest,
  header_api_key: string | undefined
): Effect.Effect<McpResponse, never, AppConfig | AppLogger | FirecrawlClient | AppMetrics> {
  switch (req.method) {
    case 'initialize':
      return handle_initialize(req);

    case 'notifications/initialized':
      // Fire-and-forget notification — return empty result per spec
      return Effect.succeed(ok_response(req.id, {}));

    case 'ping':
      return Effect.succeed(ok_response(req.id, {}));

    case 'tools/list':
      return Effect.succeed(handle_tools_list(req));

    case 'tools/call':
      return handle_tools_call(req, header_api_key);

    default:
      return Effect.succeed({
        jsonrpc: '2.0' as const,
        id: req.id,
        error: { code: McpErrorCode.method_not_found, message: `Method not found: ${req.method}` }
      });
  }
}

// ---------------------------------------------------------------------------
// Web Request adapter — parse body → dispatch → serialize response
// ---------------------------------------------------------------------------

/**
 * Converts an HTTP request into a validated MCP invocation and response.
 */
export function handle_web_request(
  request: Request
): Effect.Effect<Response, never, AppConfig | AppLogger | FirecrawlClient | AppMetrics | RateLimiter> {
  return Effect.gen(function*() {
    const config = yield* AppConfig;
    const logger = yield* AppLogger;
    const metrics = yield* AppMetrics;
    const rate_limiter = yield* RateLimiter;
    const request_started_at = Date.now();
    const request_id = crypto.randomUUID();
    const method = request.method.toUpperCase();

    const finalize = (response: Response): Response => {
      metrics.record_request(method, response.status, Date.now() - request_started_at);
      response.headers.set('X-Request-Id', request_id);
      return response;
    };

    const run_request = Effect.gen(function*() {
      const client_ip = extract_client_ip(request.headers);

      if (config.rate_limit_enabled) {
        const rl = rate_limiter.take(client_ip);
        if (!rl.allowed) {
          logger.warn('request:rate_limited', { client_ip, retry_after_seconds: rl.retry_after_seconds });
          const err_resp: McpResponse = {
            jsonrpc: '2.0',
            id: null,
            error: { code: McpErrorCode.rate_limited, message: 'Rate limit exceeded' }
          };
          return finalize(
            new Response(JSON.stringify(err_resp), {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(rl.retry_after_seconds),
                'X-RateLimit-Remaining': String(rl.remaining)
              }
            })
          );
        }
      }

      // Origin validation — only enforced when ALLOWED_ORIGINS is configured.
      // Requests without an Origin header (CLI, server-to-server) are always permitted.
      if (!validate_origin(request.headers, config.allowed_origins)) {
        logger.warn('request:origin_rejected', { origin: request.headers.get('origin'), client_ip });
        const err_resp: McpResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: McpErrorCode.unauthorized, message: 'Origin not allowed' }
        };
        return finalize(
          new Response(JSON.stringify(err_resp), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'null' // explicitly deny CORS
            }
          })
        );
      }

      // EARLY REJECTION (latency optimization only — NOT a security boundary):
      // If Content-Length is present and unambiguously exceeds the limit, reject
      // immediately to avoid buffering an obviously oversized body. A client can
      // omit or falsify this header; the authoritative check below operates on the
      // actual buffered byte count and cannot be bypassed.
      const content_length = request.headers.get('content-length');
      if (content_length !== null) {
        const parsed = Number(content_length);
        if (Number.isFinite(parsed) && parsed > config.max_request_body_bytes) {
          const err_resp: McpResponse = {
            jsonrpc: '2.0',
            id: null,
            error: { code: McpErrorCode.invalid_request, message: 'Request body too large' }
          };
          return finalize(
            new Response(JSON.stringify(err_resp), { status: 413, headers: { 'Content-Type': 'application/json' } })
          );
        }
      }

      const header_api_key = extract_api_key(request.headers);

      const raw_body_result = yield* Effect.tryPromise(() => request.text()).pipe(Effect.either);
      if (raw_body_result._tag === 'Left') {
        const err_resp: McpResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: McpErrorCode.parse_error, message: 'Failed to read request body' }
        };
        return finalize(
          new Response(JSON.stringify(err_resp), { status: 400, headers: { 'Content-Type': 'application/json' } })
        );
      }
      const raw_body = raw_body_result.right;

      // AUTHORITATIVE size enforcement — operates on the actual buffered byte count.
      // This check cannot be bypassed regardless of what the client sent in Content-Length.
      const body_bytes = new TextEncoder().encode(raw_body).byteLength;
      if (body_bytes > config.max_request_body_bytes) {
        const err_resp: McpResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: McpErrorCode.invalid_request, message: 'Request body too large' }
        };
        return finalize(
          new Response(JSON.stringify(err_resp), { status: 413, headers: { 'Content-Type': 'application/json' } })
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw_body);
      } catch {
        const err_resp: McpResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: McpErrorCode.parse_error, message: 'Invalid JSON' }
        };
        return finalize(
          new Response(JSON.stringify(err_resp), { status: 400, headers: { 'Content-Type': 'application/json' } })
        );
      }

      const decode_result = yield* Schema.decodeUnknown(McpRequestSchema)(parsed).pipe(Effect.either);

      if (decode_result._tag === 'Left') {
        const err_resp: McpResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: McpErrorCode.invalid_request, message: 'Invalid MCP request structure' }
        };
        return finalize(
          new Response(JSON.stringify(err_resp), { status: 400, headers: { 'Content-Type': 'application/json' } })
        );
      }

      const req = decode_result.right;
      logger.debug('mcp:request', { method: req.method });

      const response = yield* handle_mcp_request(req, header_api_key);

      return finalize(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        })
      );
    });

    return yield* run_request.pipe(
      Effect.timeoutFail({
        duration: `${config.request_timeout_ms} millis`,
        onTimeout: () =>
          finalize(
            new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: { code: McpErrorCode.internal_error, message: 'Request timed out' }
              }),
              { status: 504, headers: { 'Content-Type': 'application/json' } }
            )
          )
      }),
      Effect.catchAll((timeout_response) => Effect.succeed(timeout_response))
    );
  });
}
