// file: src/services/logger.ts
// description: Structured logger service — Effect Layer with log-level gating
// reference: https://effect.website/docs/guides/observability/logging

import { Context, Effect, Layer } from 'effect';
import { AppConfig } from '../config/app-config.ts';

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface LoggerOps {
  readonly debug: (message: string, data?: Record<string, unknown>) => void;
  readonly info: (message: string, data?: Record<string, unknown>) => void;
  readonly warn: (message: string, data?: Record<string, unknown>) => void;
  readonly error: (message: string, data?: Record<string, unknown>) => void;
}

export class AppLogger extends Context.Tag('AppLogger')<AppLogger, LoggerOps>() {}

// ---------------------------------------------------------------------------
// Level ordering
// ---------------------------------------------------------------------------

const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVEL_ORDER;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function make_logger(min_level: LogLevel): LoggerOps {
  const should_log = (level: LogLevel): boolean => LEVEL_ORDER[level] >= LEVEL_ORDER[min_level];

  const emit = (level: LogLevel, message: string, data?: Record<string, unknown>): void => {
    if (!should_log(level)) return;
    const ts = new Date().toISOString();
    const entry = JSON.stringify({ ts, level, message, ...(data ?? {}) });
    if (level === 'error' || level === 'warn') {
      console.error(entry);
    } else {
      console.log(entry);
    }
  };

  return {
    debug: (msg, data) => emit('debug', msg, data),
    info: (msg, data) => emit('info', msg, data),
    warn: (msg, data) => emit('warn', msg, data),
    error: (msg, data) => emit('error', msg, data)
  };
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const AppLoggerLive: Layer.Layer<AppLogger, never, AppConfig> = Layer.effect(
  AppLogger,
  Effect.gen(function*() {
    const config = yield* AppConfig;
    return make_logger(config.log_level);
  })
);
