// file: api/mcp.ts
// description: Vercel edge-compatible MCP endpoint — bootstraps Effect runtime per-request
// reference: https://vercel.com/docs/functions/runtimes/node-js

import { Effect, ManagedRuntime } from 'effect';
import { handle_web_request } from '../src/api/groups/mcp-handler.ts';
import { handle_sse_request } from '../src/api/groups/sse-handler.ts';
import { AppLive } from '../src/lib/app-layer.ts';

// ---------------------------------------------------------------------------
// Shared runtime — created once per cold-start, reused across warm invocations
// ---------------------------------------------------------------------------

const runtime = ManagedRuntime.make(AppLive);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const config = { maxDuration: 60 };

export default async function handler(request: Request): Promise<Response> {
  // Health probe short-circuit
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check if client expects SSE (e.g., LM Studio)
  const accept_header = request.headers.get('Accept') || '';
  const wants_sse = accept_header.includes('text/event-stream');

  if (wants_sse) {
    // Use SSE transport for clients like LM Studio
    return runtime.runPromise(handle_sse_request(request));
  }

  // Use standard JSON-RPC transport for other clients
  return runtime.runPromise(handle_web_request(request));
}
