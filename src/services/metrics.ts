// file: src/services/metrics.ts
// description: In-memory observability metrics service with Prometheus export

import { Context, Effect, Layer } from 'effect';

/**
 * Public observability operations used by HTTP and tool handlers.
 */
export interface MetricsOps {
  /** Records one HTTP request outcome. */
  readonly record_request: (method: string, status: number, duration_ms: number) => void;
  /** Records one tool call outcome. */
  readonly record_tool_call: (tool: string, outcome: 'success' | 'failure', duration_ms: number) => void;
  /** Exports all in-memory metrics as Prometheus text format. */
  readonly export_prometheus: () => string;
}

/** Dependency-inverted metrics service tag. */
export class AppMetrics extends Context.Tag('AppMetrics')<AppMetrics, MetricsOps>() {}

function labels(input: Record<string, string | number>): string {
  const esc = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
  const parts = Object.entries(input).map(([key, value]) => `${key}="${esc(String(value))}"`);
  return `{${parts.join(',')}}`;
}

/**
 * In-memory metrics implementation; suitable for single-instance runtime contexts.
 */
export const AppMetricsLive: Layer.Layer<AppMetrics> = Layer.succeed(
  AppMetrics,
  (() => {
    const started_at = Date.now();
    const request_total = new Map<string, number>();
    const tool_total = new Map<string, number>();
    let request_duration_ms_total = 0;
    let request_duration_count = 0;
    let tool_duration_ms_total = 0;
    let tool_duration_count = 0;

    const inc = (table: Map<string, number>, key: string): void => {
      table.set(key, (table.get(key) ?? 0) + 1);
    };

    return {
      record_request: (method, status, duration_ms) => {
        inc(request_total, `${method}|${status}`);
        request_duration_ms_total += Math.max(0, duration_ms);
        request_duration_count += 1;
      },

      record_tool_call: (tool, outcome, duration_ms) => {
        inc(tool_total, `${tool}|${outcome}`);
        tool_duration_ms_total += Math.max(0, duration_ms);
        tool_duration_count += 1;
      },

      export_prometheus: () => {
        const lines: string[] = [];

        lines.push('# HELP mcp_uptime_seconds Process uptime in seconds');
        lines.push('# TYPE mcp_uptime_seconds gauge');
        lines.push(`mcp_uptime_seconds ${(Date.now() - started_at) / 1000}`);

        lines.push('# HELP mcp_requests_total Total HTTP requests handled');
        lines.push('# TYPE mcp_requests_total counter');
        for (const [key, value] of request_total.entries()) {
          const [method, status] = key.split('|');
          lines.push(`mcp_requests_total${labels({ method: method ?? 'unknown', status: status ?? '0' })} ${value}`);
        }

        lines.push('# HELP mcp_request_duration_ms_total Sum of HTTP request durations in milliseconds');
        lines.push('# TYPE mcp_request_duration_ms_total counter');
        lines.push(`mcp_request_duration_ms_total ${request_duration_ms_total}`);

        lines.push('# HELP mcp_request_duration_ms_count Count of HTTP request duration samples');
        lines.push('# TYPE mcp_request_duration_ms_count counter');
        lines.push(`mcp_request_duration_ms_count ${request_duration_count}`);

        lines.push('# HELP mcp_tool_calls_total Total tool invocations');
        lines.push('# TYPE mcp_tool_calls_total counter');
        for (const [key, value] of tool_total.entries()) {
          const [tool, outcome] = key.split('|');
          lines.push(
            `mcp_tool_calls_total${labels({ tool: tool ?? 'unknown', outcome: outcome ?? 'unknown' })} ${value}`
          );
        }

        lines.push('# HELP mcp_tool_duration_ms_total Sum of tool execution durations in milliseconds');
        lines.push('# TYPE mcp_tool_duration_ms_total counter');
        lines.push(`mcp_tool_duration_ms_total ${tool_duration_ms_total}`);

        lines.push('# HELP mcp_tool_duration_ms_count Count of tool execution duration samples');
        lines.push('# TYPE mcp_tool_duration_ms_count counter');
        lines.push(`mcp_tool_duration_ms_count ${tool_duration_count}`);

        return `${lines.join('\n')}\n`;
      }
    } satisfies MetricsOps;
  })()
);
