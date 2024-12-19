import * as Sentry from '@sentry/node';

import config from './config/config';

Sentry.init({
  dsn: config.SENTRY_DSN,
  integrations: [Sentry.prismaIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  environment: config.DOPPLER_CONFIG,
  release: config.QUIZLORD_VERSION,
});
