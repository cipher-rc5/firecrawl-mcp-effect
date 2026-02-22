#!/usr/bin/env bun
// file: src/stdio-server.ts
// description: MCP stdio transport server for LM Studio — reads JSON-RPC from stdin, writes to stdout
// reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#stdio

import { Effect, ManagedRuntime } from 'effect';
import { Schema } from 'effect';
import { handle_mcp_request } from './api/groups/mcp-handler.ts';
import type { McpRequest, McpResponse } from './api/schemas/firecrawl-schemas.ts';
import { McpRequest as McpRequestSchema } from './api/schemas/firecrawl-schemas.ts';
import { AppConfig } from './config/app-config.ts';
import { AppLive } from './lib/app-layer.ts';

// ---------------------------------------------------------------------------
// Runtime setup
// ---------------------------------------------------------------------------

const runtime = ManagedRuntime.make(AppLive);

// ---------------------------------------------------------------------------
// Stdio transport implementation
// ---------------------------------------------------------------------------

/**
 * Extract ID from parsed JSON if possible, otherwise use 0
 */
function extract_id(parsed: unknown): string | number {
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const id = obj['id'];
    if (typeof id === 'string' || typeof id === 'number') {
      return id;
    }
  }
  // Use 0 instead of null for compatibility with Claude Desktop
  return 0;
}

/**
 * Process a single line of JSON-RPC input from stdin.
 */
async function process_line(line: string): Promise<void> {
  // Skip empty lines
  if (line.trim() === '') return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    // Invalid JSON — send parse error to stdout
    // Use id: 0 instead of null for Claude Desktop compatibility
    const error_response: McpResponse = {
      jsonrpc: '2.0',
      id: 0,
      error: { code: -32700, message: 'Parse error: Invalid JSON' }
    };
    console.log(JSON.stringify(error_response));
    return;
  }

  // Validate MCP request schema
  const decode_result = await runtime.runPromise(Schema.decodeUnknown(McpRequestSchema)(parsed).pipe(Effect.either));

  if (decode_result._tag === 'Left') {
    // Try to extract ID from parsed object, use 0 if not found
    const id = extract_id(parsed);
    const error_response: McpResponse = {
      jsonrpc: '2.0',
      id,
      error: { code: -32600, message: 'Invalid Request: Malformed MCP request' }
    };
    console.log(JSON.stringify(error_response));
    return;
  }

  const request = decode_result.right as McpRequest;

  // Get API key from environment (stdio mode always uses env-based auth)
  const api_key = await runtime.runPromise(Effect.gen(function*() {
    const config = yield* AppConfig;
    return config.firecrawl_api_key;
  }));

  // Extract API key string (unwrap Redacted if present)
  const api_key_string = api_key ? String(api_key) : undefined;

  // Handle the MCP request
  const response = await runtime.runPromise(handle_mcp_request(request, api_key_string));

  // Write response to stdout (newline-delimited JSON-RPC)
  console.log(JSON.stringify(response));
}

/**
 * Main stdio loop — read lines from stdin, process each as JSON-RPC message.
 */
async function main(): Promise<void> {
  // Get protocol version from config
  const protocol_version = await runtime.runPromise(Effect.gen(function*() {
    const config = yield* AppConfig;
    return config.mcp_version;
  }));

  // Log to stderr (not stdout, which is reserved for MCP messages)
  console.error('[firecrawl-mcp-stdio] Starting stdio transport server');
  console.error(`[firecrawl-mcp-stdio] Protocol: MCP ${protocol_version}`);
  console.error('[firecrawl-mcp-stdio] Reading JSON-RPC messages from stdin...');

  // Use Bun's stdin stream
  for await (const line of console) {
    try {
      await process_line(line);
    } catch (error) {
      // Log errors to stderr
      console.error('[firecrawl-mcp-stdio] Error processing line:', error);

      // Send internal error to stdout (use id: 0 for compatibility)
      const error_response: McpResponse = { jsonrpc: '2.0', id: 0, error: { code: -32603, message: 'Internal error' } };
      console.log(JSON.stringify(error_response));
    }
  }

  console.error('[firecrawl-mcp-stdio] stdin closed, shutting down');
  await runtime.dispose();
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

main().catch((error) => {
  console.error('[firecrawl-mcp-stdio] Fatal error:', error);
  process.exit(1);
});
