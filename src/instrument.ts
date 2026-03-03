import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { logger } from './util/logger.js';

// This file is loaded via --import before the main application module graph.
// Only import modules that won't transitively load libraries Sentry needs to
// instrument (e.g. Express). The logger is safe since it only imports @sentry/node.
logger.info('Initialising Sentry instrumentation');
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? '',
  integrations: [Sentry.prismaIntegration(), Sentry.graphqlIntegration(), nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  environment: process.env.DOPPLER_CONFIG,
  release: process.env.QUIZLORD_VERSION ?? 'development',
});
