// file: src/api/groups/sse-handler.ts
// description: SSE (Server-Sent Events) transport for MCP — LM Studio compatibility
// reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

import { Effect } from 'effect';
import { AppConfig } from '../../config/app-config.ts';
import { extract_api_key } from '../../lib/utils.ts';
import { FirecrawlClient } from '../../services/firecrawl-client.ts';
import { AppLogger } from '../../services/logger.ts';
import { AppMetrics } from '../../services/metrics.ts';
import { RateLimiter } from '../../services/rate-limiter.ts';
import type { McpRequest, McpResponse } from '../schemas/firecrawl-schemas.ts';
import { handle_mcp_request } from './mcp-handler.ts';

/**
 * Formats an SSE event according to the spec
 * https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
function format_sse_event(data: string, event_id?: string): string {
  let message = '';
  if (event_id) {
    message += `id: ${event_id}\n`;
  }
  // Split data into lines and prefix each with "data: "
  const lines = data.split('\n');
  for (const line of lines) {
    message += `data: ${line}\n`;
  }
  message += '\n'; // Empty line to signal end of event
  return message;
}

/**
 * Handles SSE transport for MCP.
 * LM Studio expects:
 * 1. POST requests with Accept: text/event-stream
 * 2. Response with Content-Type: text/event-stream
 * 3. JSON-RPC messages sent as SSE events
 */
export function handle_sse_request(
  request: Request
): Effect.Effect<Response, never, AppConfig | AppLogger | FirecrawlClient | AppMetrics | RateLimiter> {
  return Effect.gen(function*() {
    const config = yield* AppConfig;
    const logger = yield* AppLogger;
    const request_id = crypto.randomUUID();

    logger.debug('sse:request:start', { request_id, method: request.method });

    // Extract API key from headers
    const header_api_key = extract_api_key(request.headers);

    // Parse the incoming JSON-RPC request from body
    const raw_body_result = yield* Effect.tryPromise(() => request.text()).pipe(Effect.either);
    if (raw_body_result._tag === 'Left') {
      logger.warn('sse:read_error', { request_id });
      return new Response(
        format_sse_event(
          JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Failed to read request body' } })
        ),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Request-Id': request_id
          }
        }
      );
    }
    const raw_body = raw_body_result.right;
    let mcp_request: McpRequest;

    try {
      const parsed = JSON.parse(raw_body);
      mcp_request = parsed as McpRequest;
    } catch {
      logger.warn('sse:parse_error', { request_id });
      return new Response(
        format_sse_event(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Request-Id': request_id
          }
        }
      );
    }

    logger.debug('sse:mcp_request', { request_id, method: mcp_request.method, id: mcp_request.id });

    // Handle the MCP request using the existing handler
    const mcp_response = yield* handle_mcp_request(mcp_request, header_api_key);

    // Format the response as an SSE event
    const event_id = crypto.randomUUID();
    const sse_data = format_sse_event(JSON.stringify(mcp_response), event_id);

    logger.debug('sse:response', { request_id, event_id });

    // Return SSE response
    return new Response(sse_data, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'X-Request-Id': request_id
      }
    });
  });
}
