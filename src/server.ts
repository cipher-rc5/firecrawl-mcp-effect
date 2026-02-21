// file: src/server.ts
// description: Local Bun HTTP server for development — mirrors Vercel handler behaviour
// reference: https://bun.sh/docs/api/http

import { Effect, ManagedRuntime } from 'effect';
import { handle_web_request } from './api/groups/mcp-handler.ts';
import { AppConfig } from './config/app-config.ts';
import { AppLive } from './lib/app-layer.ts';
import { AppMetrics } from './services/metrics.ts';

const runtime = ManagedRuntime.make(AppLive);

const port = await runtime.runPromise(Effect.gen(function*() {
  const config = yield* AppConfig;
  return config.port;
}));

const server = Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/metrics' && request.method === 'GET') {
      const body = await runtime.runPromise(Effect.gen(function*() {
        const metrics = yield* AppMetrics;
        return metrics.export_prometheus();
      }));

      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', server: 'firecrawl-mcp' }), {
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
});

console.log(`[firecrawl-mcp] listening on http://${server.hostname}:${server.port}`);
