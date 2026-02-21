// file: src/lib/utils.ts
// description: Pure utility functions — object cleaning, serialization, header parsing
// reference: https://effect.website/docs/guides/essentials/pipeline

import { Effect, Schema } from 'effect';
import { parse_error, type ParseError } from '../errors/mcp-errors.ts';

// ---------------------------------------------------------------------------
// Object utilities
// ---------------------------------------------------------------------------

/**
 * Strips top-level keys whose values are null, undefined, empty string,
 * empty array, or empty object. Does NOT recurse.
 */
export function remove_empty_top_level<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) {
      continue;
    }
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Serialize any value to indented JSON string for MCP text content. */
export function as_text(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Header utilities
// ---------------------------------------------------------------------------

/**
 * Extracts an API key from standard HTTP request headers.
 * Priority: x-firecrawl-api-key | x-api-key | Authorization Bearer
 */
export function extract_api_key(headers: Headers | Record<string, string | string[] | undefined>): string | undefined {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined;
    }
    const v = headers[name];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const direct = get('x-firecrawl-api-key') ?? get('x-api-key');

  if (direct !== undefined) return direct;

  const auth = get('authorization');
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() || undefined;
  }

  return undefined;
}

/**
 * Best-effort client IP extraction for local and proxy deployments.
 */
export function extract_client_ip(headers: Headers | Record<string, string | string[] | undefined>): string {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined;
    }
    const v = headers[name];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const xff = get('x-forwarded-for');
  if (typeof xff === 'string' && xff.trim() !== '') {
    const first = xff.split(',')[0]?.trim();
    if (first !== undefined && first !== '') return first;
  }

  const real_ip = get('x-real-ip');
  if (typeof real_ip === 'string' && real_ip.trim() !== '') return real_ip.trim();

  const cf_ip = get('cf-connecting-ip');
  if (typeof cf_ip === 'string' && cf_ip.trim() !== '') return cf_ip.trim();

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Schema-based JSON parsing
// ---------------------------------------------------------------------------

/**
 * Parse raw JSON body using an Effect Schema.
 * Returns a ParseError on failure.
 */
export function parse_json_body<A, I>(raw: string, schema: Schema.Schema<A, I>): Effect.Effect<A, ParseError> {
  return Effect.gen(function*() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return yield* Effect.fail(parse_error('Invalid JSON in request body'));
    }
    return yield* Schema.decodeUnknown(schema)(parsed).pipe(
      Effect.mapError((e) => parse_error(String(e.message ?? e)))
    );
  });
}
