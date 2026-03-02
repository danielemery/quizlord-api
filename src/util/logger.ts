import * as Sentry from '@sentry/node';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface ErrorLogContext extends LogContext {
  exception?: unknown;
  sentryTags?: Record<string, string>;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { timestamp, level: _level, message: _message, ...safeContext } = context ?? {};
  const entry = {
    ...safeContext,
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(entry);
  } catch {
    serialized = JSON.stringify({ timestamp: entry.timestamp, level, message, serializationError: true });
  }

  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

function logError(message: string, context?: ErrorLogContext): void {
  const { exception, sentryTags, ...rest } = context ?? {};

  // Extract error details for logging
  const logContext: LogContext = { ...rest };
  if (exception) {
    logContext.error = exception instanceof Error ? exception.message : String(exception);
    logContext.stack = exception instanceof Error ? exception.stack : undefined;
  }

  log('error', message, logContext);

  // Report to Sentry
  try {
    if (exception) {
      Sentry.captureException(exception, {
        extra: { message, ...rest },
        ...(sentryTags && { tags: sentryTags }),
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: rest,
        ...(sentryTags && { tags: sentryTags }),
      });
    }
  } catch {
    // Sentry reporting should never crash the application
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: ErrorLogContext) => logError(message, context),
};
