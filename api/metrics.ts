// file: api/metrics.ts
// description: Prometheus metrics endpoint for observability scraping

import { Effect, ManagedRuntime } from 'effect';
import { AppLive } from '../src/lib/app-layer.ts';
import { AppMetrics } from '../src/services/metrics.ts';

const runtime = ManagedRuntime.make(AppLive);

export default async function handler(_request: Request): Promise<Response> {
  const body = await runtime.runPromise(Effect.gen(function*() {
    const metrics = yield* AppMetrics;
    return metrics.export_prometheus();
  }));

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
