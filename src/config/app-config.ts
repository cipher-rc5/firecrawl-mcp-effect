// file: src/config/app-config.ts
// description: Effect Config layer — typed, secret-safe application configuration
// reference: https://effect.website/docs/guides/configuration

import { Config, ConfigError, Context, Effect, Layer, Redacted } from 'effect';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Strongly-typed runtime configuration resolved from environment variables.
 */
export interface AppConfigShape {
  readonly firecrawl_api_key: Redacted.Redacted | undefined;
  readonly firecrawl_api_url: string | undefined;
  readonly cloud_service: boolean;
  readonly safe_mode: boolean;
  readonly max_request_body_bytes: number;
  readonly request_timeout_ms: number;
  readonly rate_limit_enabled: boolean;
  readonly rate_limit_requests: number;
  readonly rate_limit_window_ms: number;
  readonly port: number;
  readonly log_level: 'debug' | 'info' | 'warn' | 'error';
  readonly mcp_version: string;
  /** Comma-separated allowlist of permitted Origin header values. undefined = disabled (open). */
  readonly allowed_origins: ReadonlyArray<string> | undefined;
}

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

export class AppConfig extends Context.Tag('AppConfig')<AppConfig, AppConfigShape>() {}

function normalize_optional_string(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalize_optional_redacted(value: Redacted.Redacted | undefined): Redacted.Redacted | undefined {
  if (value === undefined) return undefined;
  const revealed = Redacted.value(value).trim();
  return revealed === '' ? undefined : Redacted.make(revealed);
}

function positive_or_default(value: number, default_value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : default_value;
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

const log_level_config = Config.literal('debug', 'info', 'warn', 'error')('LOG_LEVEL').pipe(
  Config.withDefault('info' as const)
);

/**
 * Live configuration layer with normalization and safe defaults.
 */
export const AppConfigLive: Layer.Layer<AppConfig, ConfigError.ConfigError> = Layer.effect(
  AppConfig,
  Effect.gen(function*() {
    const cloud_service = yield* Config.boolean('CLOUD_SERVICE').pipe(Config.withDefault(false));

    const safe_mode_default = cloud_service;
    const safe_mode = yield* Config.boolean('SAFE_MODE').pipe(Config.withDefault(safe_mode_default));

    const firecrawl_api_key = yield* Config.redacted('FIRECRAWL_API_KEY').pipe(
      Config.option,
      Effect.map((opt) => normalize_optional_redacted(opt._tag === 'Some' ? opt.value : undefined))
    );

    const firecrawl_api_url = yield* Config.string('FIRECRAWL_API_URL').pipe(
      Config.option,
      Effect.map((opt) => normalize_optional_string(opt._tag === 'Some' ? opt.value : undefined))
    );

    const max_request_body_bytes = yield* Config.integer('MAX_REQUEST_BODY_BYTES').pipe(
      Config.withDefault(1_048_576),
      Effect.map((n) => positive_or_default(n, 1_048_576))
    );

    const request_timeout_ms = yield* Config.integer('REQUEST_TIMEOUT_MS').pipe(
      Config.withDefault(25_000),
      Effect.map((n) => positive_or_default(n, 25_000))
    );

    const rate_limit_enabled = yield* Config.boolean('RATE_LIMIT_ENABLED').pipe(Config.withDefault(true));

    const rate_limit_requests = yield* Config.integer('RATE_LIMIT_REQUESTS').pipe(
      Config.withDefault(120),
      Effect.map((n) => positive_or_default(n, 120))
    );

    const rate_limit_window_ms = yield* Config.integer('RATE_LIMIT_WINDOW_MS').pipe(
      Config.withDefault(60_000),
      Effect.map((n) => positive_or_default(n, 60_000))
    );

    const port = yield* Config.integer('PORT').pipe(Config.withDefault(3000));
    const log_level = yield* log_level_config;
    const mcp_version = yield* Config.string('MCP_VERSION').pipe(Config.withDefault('2024-11-05'));

    // ALLOWED_ORIGINS: comma-separated list of exact Origin header values to permit.
    // Omit or set to '*' to disable validation entirely (default: disabled).
    const allowed_origins = yield* Config.string('ALLOWED_ORIGINS').pipe(
      Config.option,
      Effect.map((opt): ReadonlyArray<string> | undefined => {
        if (opt._tag === 'None') return undefined;
        const raw = opt.value.trim();
        if (raw === '' || raw === '*') return undefined; // explicit wildcard = disabled
        return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      })
    );

    return {
      firecrawl_api_key,
      firecrawl_api_url,
      cloud_service,
      safe_mode,
      max_request_body_bytes,
      request_timeout_ms,
      rate_limit_enabled,
      rate_limit_requests,
      rate_limit_window_ms,
      port,
      log_level,
      mcp_version,
      allowed_origins
    } satisfies AppConfigShape;
  })
);
