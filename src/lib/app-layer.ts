// file: src/lib/app-layer.ts
// description: Composes the full application Layer DAG for dependency injection
// reference: https://effect.website/docs/guides/context-management/layers#merging-layers

import { Layer } from 'effect';
import { AppConfigLive } from '../config/app-config.ts';
import { FirecrawlClientLive } from '../services/firecrawl-client.ts';
import { AppLoggerLive } from '../services/logger.ts';
import { AppMetricsLive } from '../services/metrics.ts';
import { RateLimiterLive } from '../services/rate-limiter.ts';

// ---------------------------------------------------------------------------
// Full application layer
//
// Dependency graph:
//   AppConfig (leaf)
//     -> AppLogger
//     -> FirecrawlClient
// ---------------------------------------------------------------------------

/**
 * Full runtime dependency graph used by API handlers and local server.
 */
export const AppLive = Layer.mergeAll(
  AppConfigLive,
  AppLoggerLive.pipe(Layer.provide(AppConfigLive)),
  AppMetricsLive,
  FirecrawlClientLive.pipe(Layer.provide(AppConfigLive)),
  RateLimiterLive.pipe(Layer.provide(AppConfigLive))
);
