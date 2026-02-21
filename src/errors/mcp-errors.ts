// file: src/errors/mcp-errors.ts
// description: Tagged domain errors for the MCP server — maps to JSON-RPC error codes
// reference: https://spec.modelcontextprotocol.io/specification/server/utilities/error/

import { Data } from 'effect';

// ---------------------------------------------------------------------------
// JSON-RPC / MCP error codes
// ---------------------------------------------------------------------------

export const McpErrorCode = {
  parse_error: -32700,
  invalid_request: -32600,
  method_not_found: -32601,
  invalid_params: -32602,
  internal_error: -32603,
  // MCP-specific
  unauthorized: -32001,
  configuration_error: -32002,
  firecrawl_error: -32003, // unclassified upstream error
  tool_not_found: -32004,
  rate_limited: -32005,
  // Granular upstream Firecrawl error sub-codes
  firecrawl_unauthorized: -32010, // 401 from upstream
  firecrawl_forbidden: -32011, // 403 from upstream
  firecrawl_rate_limited: -32012, // 429 from upstream
  firecrawl_not_found: -32013, // 404 from upstream
  firecrawl_server_error: -32014, // 5xx from upstream
  firecrawl_timeout: -32015, // network timeout
  firecrawl_network_error: -32016 // DNS / connection refused
} as const;

export type McpErrorCode = (typeof McpErrorCode)[keyof typeof McpErrorCode];

// ---------------------------------------------------------------------------
// Base tagged errors
// ---------------------------------------------------------------------------

export class UnauthorizedError
  extends Data.TaggedError('UnauthorizedError')<{ readonly message: string, readonly code: McpErrorCode }> {}

export class ConfigurationError
  extends Data.TaggedError('ConfigurationError')<{ readonly message: string, readonly code: McpErrorCode }> {}

export class FirecrawlClientError
  extends Data.TaggedError('FirecrawlClientError')<
    { readonly message: string, readonly cause: unknown, readonly code: McpErrorCode }
  > {}

export class ToolNotFoundError
  extends Data.TaggedError('ToolNotFoundError')<{ readonly tool_name: string, readonly code: McpErrorCode }> {}

export class InvalidParamsError
  extends Data.TaggedError('InvalidParamsError')<
    { readonly message: string, readonly field?: string | undefined, readonly code: McpErrorCode }
  > {}

export class ParseError
  extends Data.TaggedError('ParseError')<{ readonly message: string, readonly code: McpErrorCode }> {}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

export type McpDomainError =
  | UnauthorizedError
  | ConfigurationError
  | FirecrawlClientError
  | ToolNotFoundError
  | InvalidParamsError
  | ParseError;

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export const unauthorized = (message: string): UnauthorizedError =>
  new UnauthorizedError({ message, code: McpErrorCode.unauthorized });

export const configuration_error = (message: string): ConfigurationError =>
  new ConfigurationError({ message, code: McpErrorCode.configuration_error });

export const firecrawl_error = (message: string, cause: unknown): FirecrawlClientError =>
  new FirecrawlClientError({ message, cause, code: McpErrorCode.firecrawl_error });

export const tool_not_found = (tool_name: string): ToolNotFoundError =>
  new ToolNotFoundError({ tool_name, code: McpErrorCode.tool_not_found });

export const invalid_params = (message: string, field?: string): InvalidParamsError =>
  new InvalidParamsError({ message, field, code: McpErrorCode.invalid_params });

export const parse_error = (message: string): ParseError => new ParseError({ message, code: McpErrorCode.parse_error });
