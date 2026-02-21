// file: api/mcp.ts
// description: Vercel edge-compatible MCP endpoint — bootstraps Effect runtime per-request
// reference: https://vercel.com/docs/functions/runtimes/node-js

import { Effect, ManagedRuntime } from 'effect';
import { handle_web_request } from '../src/api/groups/mcp-handler.ts';
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

  return runtime.runPromise(handle_web_request(request));
}
