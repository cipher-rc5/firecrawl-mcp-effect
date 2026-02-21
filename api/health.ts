// file: api/health.ts
// description: Lightweight health check endpoint for load balancer probes
// reference: https://vercel.com/docs/functions/runtimes/node-js

export default function handler(_request: Request): Response {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
