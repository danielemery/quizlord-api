import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import config from './config/config';

console.log('Initialising Sentry instrumentation');
Sentry.init({
  dsn: config.SENTRY_DSN,
  integrations: [Sentry.prismaIntegration(), nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  environment: config.DOPPLER_CONFIG,
  release: config.QUIZLORD_VERSION,
});
