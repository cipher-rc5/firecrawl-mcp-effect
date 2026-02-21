// file: src/lib/upstream-classifier.ts
// description: Classifies raw upstream Firecrawl rejection values into typed McpErrorCode sub-codes.
//   Isolates the unsafe `unknown` boundary so the rest of the codebase stays type-clean.

import { FirecrawlClientError, McpErrorCode } from '../errors/mcp-errors.ts';

// ---------------------------------------------------------------------------
// Internal shape used only within this module
// ---------------------------------------------------------------------------

interface UpstreamErrorShape {
  readonly status?: number;
  readonly response?: { readonly status?: number };
  readonly code?: string;
  readonly message?: string;
  readonly name?: string;
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Inspects a raw caught rejection value and returns the most specific
 * McpErrorCode describing the upstream failure, plus a sanitized message.
 *
 * All field accesses are guarded — this function must never throw.
 */
export function classify_upstream_error(cause: unknown): { readonly code: McpErrorCode, readonly message: string } {
  if (typeof cause !== 'object' || cause === null) {
    return { code: McpErrorCode.firecrawl_error, message: 'Unknown upstream error' };
  }

  const err = cause as UpstreamErrorShape;

  // Network-level failures
  if (
    err.name === 'TimeoutError' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'))
  ) {
    return { code: McpErrorCode.firecrawl_timeout, message: 'Upstream request timed out' };
  }

  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    return { code: McpErrorCode.firecrawl_network_error, message: 'Cannot reach Firecrawl service' };
  }

  // HTTP status codes — check both top-level status and nested response.status
  const http_status = err.status ?? err.response?.status;

  if (http_status === 401) {
    return { code: McpErrorCode.firecrawl_unauthorized, message: 'Firecrawl API key is invalid or expired' };
  }
  if (http_status === 403) {
    return {
      code: McpErrorCode.firecrawl_forbidden,
      message: 'Firecrawl API key does not have permission for this operation'
    };
  }
  if (http_status === 404) {
    return { code: McpErrorCode.firecrawl_not_found, message: 'Firecrawl resource not found' };
  }
  if (http_status === 429) {
    return { code: McpErrorCode.firecrawl_rate_limited, message: 'Firecrawl upstream rate limit exceeded' };
  }
  if (typeof http_status === 'number' && http_status >= 500) {
    return { code: McpErrorCode.firecrawl_server_error, message: `Firecrawl service error (HTTP ${http_status})` };
  }

  return { code: McpErrorCode.firecrawl_error, message: 'Firecrawl operation failed' };
}

/**
 * Builds a FirecrawlClientError using the classified upstream error code and message.
 */
export function classified_firecrawl_error(label: string, cause: unknown): FirecrawlClientError {
  const { code, message } = classify_upstream_error(cause);
  return new FirecrawlClientError({ message: `${message} [${label}]`, cause, code });
}
